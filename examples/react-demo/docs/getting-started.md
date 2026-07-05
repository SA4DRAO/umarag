# Getting started

## Installation

Install the package and its peer dependencies: `npm install @sa4drao/umarag @orama/orama @huggingface/transformers`. If you want the WebLLM engine (recommended unless you only target Chrome's built-in Prompt API), also install `@mlc-ai/web-llm` — it is an optional peer dependency and is only dynamically imported when the WebLLM engine is actually selected. Node 18+ is required for tooling; the runtime itself is browser-only ESM.

## Minimal usage

Create an EdgeChat with the URL of your knowledge export, call init(), then ask() or stream(). Example: `const chat = new EdgeChat({ knowledgeUrl: "/kb-export.json" }); await chat.init(); const { sources, stream } = await chat.stream("How do I authenticate?", history); for await (const delta of stream) { ui.append(delta); }`. ask() returns the full `{ answer, sources }` once; stream() resolves with the retrieved sources up front plus an async generator of answer deltas.

## Conversational memory

Both ask() and stream() take prior turns as an optional second argument: an array of { role, content } ChatMessage objects, oldest first, without the current query. Keep your own turn list and pass it back on every call — that is the assistant's memory. The most recent eight turns are included in the prompt so small on-device context windows don't overflow. Both methods call init() implicitly if you forget.

## Lifecycle

init() is idempotent while in flight and after success — concurrent callers share one promise. A failed init() is NOT cached: calling init() again retries the whole pipeline, so a transient network failure doesn't brick the instance. When you're done (e.g. a SPA route unmount), call dispose() to release GPU memory held by the LLM engine, the embedding pipeline, and the index. A disposed instance can be re-init()ed.

## Progress reporting

Pass onProgress to the config to drive a loading UI. umarag reports coarse phases ("Loading knowledge base…", "Loading embedding model…") with progress 0, and WebLLM reports granular download/compile progress with text and a 0–1 progress fraction. Chrome's built-in model reports "Downloading built-in model…" when the Prompt API needs to fetch its model first.
