import { describe, it, expect } from "vitest";
import { buildIndex, queryIndex } from "../src/retriever.js";
import type { KnowledgeExport } from "../src/types.js";

const kb: KnowledgeExport = {
  schemaVersion: 1,
  embeddingModel: "test-fixture",
  embeddingDim: 3,
  chunks: [
    { id: "a", text: "reset your password from settings", embedding: [1, 0, 0], metadata: { title: "Password" } },
    { id: "b", text: "configure webhooks in the dashboard", embedding: [0, 1, 0], metadata: { title: "Webhooks" } },
    { id: "c", text: "rate limits are 60 requests per minute", embedding: [0, 0, 1], metadata: { title: "Limits" } },
  ],
};

describe("retriever", () => {
  it("returns the closest chunk first by cosine similarity", async () => {
    const db = await buildIndex(kb);
    const hits = await queryIndex(db, [0.9, 0.1, 0], 2, 0);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.id).toBe("a");
    expect(hits[0]!.metadata).toEqual({ title: "Password" });
  });

  it("respects topK", async () => {
    const db = await buildIndex(kb);
    const hits = await queryIndex(db, [1, 1, 1], 1, 0);
    expect(hits.length).toBe(1);
  });
});

describe("retriever minScore", () => {
  it("filters chunks below the minimum similarity", async () => {
    const db = await buildIndex(kb);
    const all = await queryIndex(db, [0.9, 0.1, 0], 3, 0);
    const strict = await queryIndex(db, [0.9, 0.1, 0], 3, 0.9);
    expect(all.length).toBeGreaterThan(strict.length);
    expect(strict.every((h) => h.score >= 0.9)).toBe(true);
  });
});
