import { describe, it, expect, vi, afterEach } from "vitest";
import { selectEngine, checkCompatibility } from "../src/engine.js";
import { EdgeChatUnsupportedError } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("selectEngine in a non-browser environment (no LanguageModel, no navigator.gpu)", () => {
  it("auto falls through both engines and throws EdgeChatUnsupportedError naming both", async () => {
    await expect(selectEngine({ knowledgeUrl: "unused" })).rejects.toThrow(EdgeChatUnsupportedError);
    await expect(selectEngine({ knowledgeUrl: "unused" })).rejects.toThrow(/Prompt API.*WebGPU|WebGPU.*Prompt API/);
  });

  it("forcing 'webllm' throws EdgeChatUnsupportedError without attempting a model download", async () => {
    await expect(selectEngine({ knowledgeUrl: "unused", engine: "webllm" })).rejects.toThrow(
      EdgeChatUnsupportedError,
    );
  });

  it("forcing 'prompt-api' throws EdgeChatUnsupportedError when window.LanguageModel is absent", async () => {
    await expect(selectEngine({ knowledgeUrl: "unused", engine: "prompt-api" })).rejects.toThrow(
      EdgeChatUnsupportedError,
    );
  });
});

describe("selectEngine 'auto' preference order", () => {
  it("picks prompt-api when it is available and no WebLLM model was configured", async () => {
    vi.stubGlobal("LanguageModel", { availability: async () => "available" });
    const engine = await selectEngine({ knowledgeUrl: "unused" });
    expect(engine.kind).toBe("prompt-api");
  });

  it("prefers webllm when a model is configured, but still falls back to prompt-api without WebGPU", async () => {
    vi.stubGlobal("LanguageModel", { availability: async () => "available" });
    const engine = await selectEngine({ knowledgeUrl: "unused", webllmModel: "some-model" });
    expect(engine.kind).toBe("prompt-api");
  });
});

describe("prompt-api engine multi-turn", () => {
  it("seeds the session with system + history and prompts only the last user turn", async () => {
    let initialPrompts: unknown;
    let prompted: string | undefined;
    vi.stubGlobal("LanguageModel", {
      availability: async () => "available",
      create: async (opts: { initialPrompts: unknown }) => {
        initialPrompts = opts.initialPrompts;
        return {
          promptStreaming: (q: string) => {
            prompted = q;
            return new ReadableStream<string>({
              start(c) {
                c.enqueue("ok");
                c.close();
              },
            });
          },
          destroy() {},
        };
      },
    });

    const engine = await selectEngine({ knowledgeUrl: "unused", engine: "prompt-api" });
    let answer = "";
    for await (const delta of engine.chat([
      { role: "system", content: "sys" },
      { role: "user", content: "first q" },
      { role: "assistant", content: "first a" },
      { role: "user", content: "second q" },
    ])) {
      answer += delta;
    }

    expect(answer).toBe("ok");
    expect(initialPrompts).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "first q" },
      { role: "assistant", content: "first a" },
    ]);
    expect(prompted).toBe("second q");
  });
});

describe("checkCompatibility", () => {
  it("reports both backends unsupported with reasons in a non-browser environment", async () => {
    const report = await checkCompatibility();
    expect(report.webllm.supported).toBe(false);
    expect(report.webllm.reason).toMatch(/WebGPU/);
    expect(report.promptApi.supported).toBe(false);
    expect(report.promptApi.reason).toMatch(/Prompt API/);
    expect(report.shaderF16).toBe(false);
  });

  it("reports prompt-api supported when LanguageModel says available", async () => {
    vi.stubGlobal("LanguageModel", { availability: async () => "available" });
    const report = await checkCompatibility();
    expect(report.promptApi).toEqual({ supported: true });
  });
});
