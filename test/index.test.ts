import { describe, it, expect, vi, afterEach } from "vitest";
import { EdgeChat } from "../src/index.js";
import { EdgeChatSchemaVersionError } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EdgeChat.init", () => {
  it("rejects a knowledge export with an unsupported schemaVersion before touching the model/index", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ schemaVersion: 2, embeddingModel: "x", embeddingDim: 3, chunks: [] }),
      })),
    );

    const chat = new EdgeChat({ knowledgeUrl: "https://example.com/kb.json" });
    await expect(chat.init()).rejects.toThrow(EdgeChatSchemaVersionError);
  });

  it("throws an informative error on a non-OK HTTP response instead of a JSON parse error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));

    const chat = new EdgeChat({ knowledgeUrl: "https://example.com/kb.json" });
    await expect(chat.init()).rejects.toThrow(/HTTP 404/);
  });

  it("does not cache a failed init — a retry re-runs the pipeline", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ schemaVersion: 2, embeddingModel: "x", embeddingDim: 3, chunks: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const chat = new EdgeChat({ knowledgeUrl: "https://example.com/kb.json" });
    await expect(chat.init()).rejects.toThrow("network down");
    // Second attempt gets past fetch (fails later, on schema) — proving init re-ran.
    await expect(chat.init()).rejects.toThrow(EdgeChatSchemaVersionError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports phase progress before fetching", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const onProgress = vi.fn();

    const chat = new EdgeChat({ knowledgeUrl: "https://example.com/kb.json", onProgress });
    await chat.init().catch(() => {});
    expect(onProgress).toHaveBeenCalledWith({ text: "Loading knowledge base…", progress: 0 });
  });
});

describe("EdgeChat.dispose", () => {
  it("is safe to call before init and leaves the instance re-init()able", async () => {
    const chat = new EdgeChat({ knowledgeUrl: "https://example.com/kb.json" });
    await chat.dispose();
    expect(chat.engineKind).toBeNull();
  });
});
