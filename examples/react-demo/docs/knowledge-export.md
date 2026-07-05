# Knowledge export

## Schema

The knowledge export is a JSON file with schemaVersion (currently 1), embeddingModel (the transformers.js model id used to embed the chunks, e.g. "Xenova/all-MiniLM-L6-v2"), embeddingDim (vector dimension, 384 for MiniLM), an optional systemPrompt (the shipped guardrail), and chunks — an array of `{ id, text, embedding, metadata? }` objects where embedding is a plain number array. The same model named in embeddingModel is loaded in the browser to embed queries, so the two always stay in sync; a dimension mismatch throws EdgeChatEmbeddingMismatchError.

## Producing an export

umarag consumes exports, it does not produce them — your build pipeline does. Any process that can run an embedding model works. The demo's scripts/build-kb.ts is one concrete example: it reads the markdown files in docs/, splits them into per-heading chunks, embeds each chunk with MiniLM via transformers.js in Node, and writes public/kb-export.json. Re-run it whenever the docs change. Chunk ids look like "configuration#engine-selection" so cited sources point back to the exact doc section.

## Scale limits

Retrieval is exact brute-force cosine similarity over an in-memory Orama index — fast at hundreds to low thousands of chunks, which covers most product-docs use cases. If your knowledge base is much larger, pre-filter or shard the export (for example one export per product area) rather than shipping everything to every browser tab.
