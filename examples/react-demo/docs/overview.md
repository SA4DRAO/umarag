# Overview

## What is umarag?

umarag (@sa4drao/umarag) is a client-side RAG chatbot runtime: retrieval and LLM inference both run in the browser, with zero backend at query time. You ship a static vector export produced by your own pipeline; umarag fetches it, builds an in-memory vector index with Orama, embeds queries with transformers.js, and generates grounded answers with an on-device LLM — either WebLLM over WebGPU or the browser's built-in Prompt API. No inference server, no API keys, no per-token bill, and no user data ever leaves the tab.

## Architecture

At init, umarag fetches the knowledge export (a JSON file from any static host), validates its schema version, and inserts the pre-computed chunk embeddings into an Orama vector index. It then loads the embedding model named in the export via transformers.js (WebGPU with automatic wasm fallback) and selects an LLM engine. At query time, the user's question is embedded on-device, the top-K most similar chunks are retrieved by cosine similarity, and a system prompt containing those chunks as numbered context is sent to the on-device LLM, which streams the answer token by token.

## The three things a team ships

umarag is designed around handing off exactly three artifacts: Guardrails (a system prompt baked into the export that pins the assistant to your docs), a Model (a WebLLM model id, optionally self-hosted weights, or the browser's built-in model), and Embeddings (the knowledge export JSON produced by your build pipeline). Everything is static files — nothing to operate.

## Project status

umarag is at version 0.4.0, pre-release, not yet published to npm. It is MIT licensed. The 0.2 release added self-hosted model weights via webllmAppConfig, retryable initialization, phase-level progress reporting, session cleanup for the Prompt API engine, and a dispose() method that releases GPU memory. The 0.3 release added checkCompatibility() for probing which engines a device can run, switchEngine() for swapping the LLM engine on a live instance without reloading the knowledge base, and smarter 'auto' engine selection that prefers a deliberately configured WebLLM model. The 0.4 release added conversational memory (a history parameter on ask() and stream(), honored by both engines), a stream() shape that returns the retrieved sources once up front, lazy loading of transformers.js for leaner initial bundles, and stricter validation of the knowledge export.
