import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Orama } from "@orama/orama";
import { buildIndex, queryIndex } from "./retriever.js";
import { buildMessages, type ChatMessage } from "./prompt.js";
import { selectEngine, type ChatEngine } from "./engine.js";
import {
  SCHEMA_VERSION,
  EdgeChatSchemaVersionError,
  EdgeChatEmbeddingMismatchError,
  type EdgeChatConfig,
  type EngineKind,
  type KnowledgeExport,
  type RetrievedSource,
} from "./types.js";

export * from "./types.js";
export { checkCompatibility } from "./engine.js";
export type { ChatMessage } from "./prompt.js";

export class EdgeChat {
  private config: EdgeChatConfig;
  private db: Orama<any> | null = null;
  private embedder: FeatureExtractionPipeline | null = null;
  private engine: ChatEngine | null = null;
  private kb: KnowledgeExport | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: EdgeChatConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._init().catch((e) => {
        this.initPromise = null; // a failed init must be retryable, not cached forever
        throw e;
      });
    }
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    this.config.onProgress?.({ text: "Loading knowledge base…", progress: 0 });
    const res = await fetch(this.config.knowledgeUrl);
    if (!res.ok) {
      throw new Error(`Fetching knowledge export from ${this.config.knowledgeUrl} failed: HTTP ${res.status}`);
    }
    const kb = (await res.json()) as KnowledgeExport;

    // Shape guard: the export comes over the network, so fail with a named cause
    // instead of a cryptic Orama/embedder error further down.
    if (typeof kb?.schemaVersion !== "number" || typeof kb.embeddingModel !== "string" || !Array.isArray(kb.chunks)) {
      throw new Error(
        `Knowledge export from ${this.config.knowledgeUrl} is malformed — expected { schemaVersion, embeddingModel, embeddingDim, chunks[] }.`,
      );
    }
    if (kb.schemaVersion !== SCHEMA_VERSION) {
      throw new EdgeChatSchemaVersionError(
        `Knowledge export schemaVersion ${kb.schemaVersion} is not supported by this client (expects ${SCHEMA_VERSION}).`,
      );
    }
    const firstChunk = kb.chunks[0];
    if (firstChunk && firstChunk.embedding?.length !== kb.embeddingDim) {
      throw new EdgeChatEmbeddingMismatchError(
        `Knowledge export declares embeddingDim ${kb.embeddingDim} but chunk "${firstChunk.id}" has a ` +
          `${firstChunk.embedding?.length ?? 0}-dim embedding — the export is internally inconsistent.`,
      );
    }

    this.kb = kb;
    this.db = await buildIndex(kb);

    this.config.onProgress?.({ text: "Loading embedding model…", progress: 0 });
    // Dynamic import (like WebLLM's) so consumers' initial bundles stay lean.
    const { pipeline } = await import("@huggingface/transformers");
    // Explicit wasm fallback: the no-device default can re-select webgpu and re-fail.
    this.embedder = await pipeline("feature-extraction", kb.embeddingModel, {
      device: "webgpu",
    }).catch(() => pipeline("feature-extraction", kb.embeddingModel, { device: "wasm" }));

    this.engine = await selectEngine(this.config); // WebLLM reports its own granular progress
  }

  /** Release the LLM engine (GPU memory), embedder, and index. The instance can be re-init()ed. */
  async dispose(): Promise<void> {
    const engine = this.engine;
    const embedder = this.embedder;
    this.engine = null;
    this.embedder = null;
    this.db = null;
    this.kb = null;
    this.initPromise = null;
    await engine?.dispose?.();
    await embedder?.dispose();
  }

  private async embedQuery(query: string): Promise<number[]> {
    if (!this.embedder || !this.kb) throw new Error("EdgeChat not initialized — call init() first.");
    const output = await this.embedder(query, { pooling: "mean", normalize: true });
    const vector = Array.from(output.data as Float32Array);
    if (vector.length !== this.kb.embeddingDim) {
      throw new EdgeChatEmbeddingMismatchError(
        `Query embedding has dim ${vector.length} but export declares embeddingDim ${this.kb.embeddingDim} ` +
          `for model "${this.kb.embeddingModel}" — the export and runtime embedding model are out of sync.`,
      );
    }
    return vector;
  }

  private async retrieve(query: string): Promise<RetrievedSource[]> {
    if (!this.db) throw new Error("EdgeChat not initialized — call init() first.");
    const queryVector = await this.embedQuery(query);
    return queryIndex(this.db, queryVector, this.config.topK ?? 4, this.config.minScore ?? 0);
  }

  /**
   * One-shot Q&A. Pass prior turns as `history` (oldest first, without the current
   * query) to give the assistant conversational memory; the last few turns are
   * included in the prompt.
   */
  async ask(query: string, history: ChatMessage[] = []): Promise<{ answer: string; sources: RetrievedSource[] }> {
    const { sources, stream } = await this.stream(query, history);
    let answer = "";
    for await (const delta of stream) answer += delta;
    return { answer, sources };
  }

  /** Which engine init() selected, or null before init. */
  get engineKind() {
    return this.engine?.kind ?? null;
  }

  /**
   * Swap the LLM engine in place — the knowledge base and embedder stay loaded.
   * The new engine is initialized before the old one is released, so a failed
   * switch leaves the current engine working. Returns the engine now active.
   */
  async switchEngine(engine: EngineKind): Promise<Exclude<EngineKind, "auto">> {
    await this.init();
    if (engine === this.engine!.kind) return this.engine!.kind;
    const next = await selectEngine({ ...this.config, engine });
    const old = this.engine;
    this.engine = next;
    this.config = { ...this.config, engine };
    await old?.dispose?.();
    return next.kind;
  }

  /**
   * Streaming Q&A: resolves with the retrieved sources up front and an async
   * generator of answer deltas. `history` works as in ask().
   */
  async stream(
    query: string,
    history: ChatMessage[] = [],
  ): Promise<{ sources: RetrievedSource[]; stream: AsyncGenerator<string> }> {
    await this.init();
    const sources = await this.retrieve(query);
    const messages = buildMessages(this.config.systemPrompt ?? this.kb?.systemPrompt, sources, query, history);
    return { sources, stream: this.engine!.chat(messages) };
  }
}
