import { create, insertMultiple, search, type Orama } from "@orama/orama";
import type { KnowledgeExport, RetrievedSource } from "./types.js";

export async function buildIndex(kb: KnowledgeExport): Promise<Orama<any>> {
  const db = await create({
    schema: { text: "string", embedding: `vector[${kb.embeddingDim}]` } as any,
  });
  await insertMultiple(
    db,
    kb.chunks.map((c) => ({ id: c.id, text: c.text, embedding: c.embedding, metadata: c.metadata })),
  );
  return db;
}

export async function queryIndex(
  db: Orama<any>,
  queryVector: number[],
  topK: number,
  minScore: number,
): Promise<RetrievedSource[]> {
  const results = await search(db, {
    mode: "vector",
    vector: { value: queryVector, property: "embedding" },
    // Default 0: topK already bounds the prompt, and question-to-paragraph cosine
    // scores routinely sit at 0.2–0.45 — any fixed cutoff silently empties results.
    similarity: minScore,
    limit: topK,
  } as any);

  return results.hits.map((hit: any) => ({
    id: hit.document.id,
    text: hit.document.text,
    score: hit.score,
    metadata: hit.document.metadata,
  }));
}
