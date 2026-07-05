/** Wire format a team's own build pipeline must produce and host somewhere fetchable. */
export const SCHEMA_VERSION = 1 as const;

export interface KnowledgeChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeExport {
  schemaVersion: 1;
  embeddingModel: string;
  embeddingDim: number;
  systemPrompt?: string;
  chunks: KnowledgeChunk[];
}

export interface RetrievedSource {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export type EngineKind = "auto" | "webllm" | "prompt-api";

export interface BackendStatus {
  supported: boolean;
  /** Present when supported is false — why this backend can't run here. */
  reason?: string;
}

/** Result of checkCompatibility(): what can run on this browser/device, checked without loading any model. */
export interface CompatibilityReport {
  webllm: BackendStatus;
  promptApi: BackendStatus;
  /** GPU supports shader-f16 — prefer a q4f16 model build when true. */
  shaderF16: boolean;
}

/** Structural subset of WebLLM's ModelRecord/AppConfig so consumers without
 * @mlc-ai/web-llm installed can still typecheck against our d.ts. */
export interface WebLLMModelRecord {
  /** Base URL of an MLC model directory (must end with "/" for non-HF hosts). */
  model: string;
  model_id: string;
  /** URL of the compiled model library .wasm. */
  model_lib: string;
  [extra: string]: unknown;
}

export interface WebLLMAppConfig {
  model_list: WebLLMModelRecord[];
  useIndexedDBCache?: boolean;
}

export interface EdgeChatConfig {
  knowledgeUrl: string;
  systemPrompt?: string;
  topK?: number;
  /** Minimum cosine similarity for a chunk to be retrieved. Default 0 (top-K only). */
  minScore?: number;
  engine?: EngineKind;
  webllmModel?: string;
  /** Override WebLLM's model registry — e.g. to serve weights from your own origin. */
  webllmAppConfig?: WebLLMAppConfig;
  onProgress?: (report: { text: string; progress: number }) => void;
}

export class EdgeChatUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeChatUnsupportedError";
  }
}

export class EdgeChatSchemaVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeChatSchemaVersionError";
  }
}

export class EdgeChatEmbeddingMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeChatEmbeddingMismatchError";
  }
}
