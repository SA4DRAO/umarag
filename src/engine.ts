import {
  EdgeChatUnsupportedError,
  type BackendStatus,
  type CompatibilityReport,
  type EdgeChatConfig,
  type EngineKind,
} from "./types.js";
import type { ChatMessage } from "./prompt.js";

export interface ChatEngine {
  kind: Exclude<EngineKind, "auto">;
  chat(messages: ChatMessage[]): AsyncGenerator<string>;
  /** Release engine resources (GPU memory, sessions). Optional per engine. */
  dispose?(): Promise<void>;
}

// ponytail: two concrete engines behind one narrow shape — not a plugin system,
// just the minimum polymorphism two genuinely different native APIs require.

async function webllmStatus(): Promise<BackendStatus & { shaderF16: boolean }> {
  const gpu = typeof navigator !== "undefined" ? (navigator as any).gpu : undefined;
  if (!gpu) {
    return {
      supported: false,
      shaderF16: false,
      reason: "WebGPU is not available on this device/browser — WebLLM cannot run (no CPU fallback by design).",
    };
  }
  // An adapter can be denied even when navigator.gpu exists (blocklisted GPU, disabled flag).
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter) {
    return {
      supported: false,
      shaderF16: false,
      reason: "WebGPU present but no adapter granted (GPU blocklisted or disabled for this page).",
    };
  }
  return { supported: true, shaderF16: adapter.features.has("shader-f16") };
}

async function promptApiStatus(): Promise<BackendStatus> {
  if (typeof LanguageModel === "undefined") {
    return { supported: false, reason: "Prompt API not present on this browser." };
  }
  if ((await LanguageModel.availability()) === "unavailable") {
    return { supported: false, reason: "Prompt API reports unavailable on this device." };
  }
  return { supported: true };
}

/** Report which engines can run here, without loading any model. */
export async function checkCompatibility(): Promise<CompatibilityReport> {
  const [{ shaderF16, ...webllm }, promptApi] = await Promise.all([webllmStatus(), promptApiStatus()]);
  return { webllm, promptApi, shaderF16 };
}

async function initPromptApi(config: EdgeChatConfig): Promise<ChatEngine> {
  const status = await promptApiStatus();
  if (!status.supported) throw new EdgeChatUnsupportedError(status.reason!);

  return {
    kind: "prompt-api",
    async *chat(messages) {
      // The final user turn goes to prompt(); everything before it (system prompt
      // + prior turns) seeds the session, so history survives multi-turn chats.
      const query = messages[messages.length - 1]?.content ?? "";
      const session = await LanguageModel.create({
        // buildMessages puts the single system message first, matching the API's
        // [system, ...turns] tuple — TS can't prove the ordering, hence the cast.
        initialPrompts: messages.slice(0, -1) as [LanguageModelSystemMessage, ...LanguageModelMessage[]],
        monitor(m) {
          m.addEventListener("downloadprogress", (e) =>
            config.onProgress?.({ text: "Downloading built-in model…", progress: (e as ProgressEvent).loaded }),
          );
        },
      });
      // Read the stream via a reader (works regardless of DOM.AsyncIterable lib support).
      const reader = session.promptStreaming(query).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock();
        session.destroy();
      }
    },
  };
}

async function initWebLLM(config: EdgeChatConfig): Promise<ChatEngine> {
  // Fail fast with a typed error instead of letting WebLLM throw mid-load.
  const status = await webllmStatus();
  if (!status.supported) throw new EdgeChatUnsupportedError(status.reason!);

  const webllm = await import("@mlc-ai/web-llm");
  const model = config.webllmModel ?? "Llama-3.2-3B-Instruct-q4f16_1-MLC";
  const engine = await webllm.CreateMLCEngine(model, {
    appConfig: config.webllmAppConfig as import("@mlc-ai/web-llm").AppConfig | undefined,
    initProgressCallback: (report: { text: string; progress: number }) => config.onProgress?.(report),
  });

  return {
    kind: "webllm",
    async *chat(messages) {
      const reply = await engine.chat.completions.create({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      });
      for await (const part of reply) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
    dispose: () => engine.unload(),
  };
}

export async function selectEngine(config: EdgeChatConfig): Promise<ChatEngine> {
  if (config.engine === "webllm") return initWebLLM(config);
  if (config.engine === "prompt-api") return initPromptApi(config);

  // 'auto' (default): prefer WebLLM when the caller configured a specific model —
  // they chose it deliberately; otherwise prefer the zero-download built-in Prompt API.
  // Either way, fall back to the other engine if the preferred one can't run.
  const [preferred, fallback] =
    config.webllmModel || config.webllmAppConfig ? [initWebLLM, initPromptApi] : [initPromptApi, initWebLLM];
  try {
    return await preferred(config);
  } catch (first) {
    try {
      return await fallback(config);
    } catch (second) {
      if (first instanceof EdgeChatUnsupportedError && second instanceof EdgeChatUnsupportedError) {
        throw new EdgeChatUnsupportedError(`No usable engine. ${first.message} ${second.message}`);
      }
      // Surface the real failure over a mere "not supported here".
      throw second instanceof EdgeChatUnsupportedError ? first : second;
    }
  }
}
