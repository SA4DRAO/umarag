# Configuration

## EdgeChatConfig fields

knowledgeUrl (required): URL of the knowledge export JSON. systemPrompt: overrides the export's baked-in system prompt. topK: number of chunks retrieved per query, default 4. minScore: minimum cosine similarity for a chunk to be retrieved, default 0 — retrieval is top-K only unless you raise it; note that question-to-paragraph scores commonly sit between 0.2 and 0.45, so high cutoffs silently empty results. engine: 'auto' | 'webllm' | 'prompt-api', default 'auto'. webllmModel: WebLLM model id, default 'Llama-3.2-3B-Instruct-q4f16_1-MLC'. webllmAppConfig: a custom WebLLM model registry for self-hosted weights. onProgress: callback receiving `{ text, progress }` reports during loading.

## Engine selection

With engine 'auto' (the default), umarag prefers WebLLM when webllmModel or webllmAppConfig is configured — you picked that model deliberately — and otherwise prefers the browser's built-in Prompt API, falling back to the other engine when the preferred one can't run. Force engine: 'webllm' or 'prompt-api' to pin one. If no engine can run, init() throws EdgeChatUnsupportedError naming both reasons.

## Compatibility and engine switching

checkCompatibility() reports — without loading any model — whether each engine can run on the current device: `{ webllm: { supported, reason? }, promptApi: { supported, reason? }, shaderF16 }`. The reason field explains why a backend can't run (e.g. no WebGPU adapter, Prompt API absent). shaderF16 is true when the GPU supports half-precision shaders — pick a q4f16 model build when true, q4f32 otherwise. switchEngine(kind) swaps the LLM engine on a live EdgeChat instance without reloading the knowledge base or embedder, and returns the engine now active; the new engine is initialized before the old one is released, so a failed switch keeps the current engine working.

## Guardrails and system prompt

The retrieved chunks are injected as numbered context entries into a system message. The default guardrail instructs the model to answer only from that context, admit when the answer isn't there, and cite sources with [n] notation. Ship your own guardrail by baking systemPrompt into the knowledge export at build time, or override it at runtime with the systemPrompt config field — the runtime field wins.

## Error types

EdgeChatUnsupportedError: no usable engine on this device (no WebGPU adapter and no Prompt API). EdgeChatSchemaVersionError: the knowledge export's schemaVersion doesn't match what this client supports (currently 1). EdgeChatEmbeddingMismatchError: the query embedding dimension differs from the export's embeddingDim — your export and runtime embedding model are out of sync. A non-OK HTTP response for the export throws a plain Error naming the URL and status code.
