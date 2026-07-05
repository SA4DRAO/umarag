# umarag React + Vite demo

Consumes `@sa4drao/umarag` (linked locally via `file:../..`) to run a fully on-device
RAG chatbot. Demonstrates the three things a team ships: **Guardrails + Model + embeddings**.

## Run

```bash
bun install
bun run build-kb   # generates public/kb-export.json (real MiniLM embeddings, ~5 docs)
bun run build      # production build → dist/
ln -sfn ../models dist/models          # expose local model weights (see models/README.md)
python3 -m http.server 8787 -d dist --bind 127.0.0.1
tailscale serve --bg --https=10000 8787   # → https://<host>.<tailnet>.ts.net:10000
```

Open in a **WebGPU-capable browser** (current Chrome, desktop or Android). First load
streams Gemma 2 2B (~1.4 GB) from this machine's disk — no model CDN involved — and
caches it in the browser. The engine is pinned to `webllm` so the from-disk model is
always what runs. (`bun run dev` still works on localhost, but doesn't serve `/models`.)

## The three shipped things

- **Guardrails** — the `systemPrompt` (baked into the export by `scripts/build-kb.ts`, and
  overridable live in the left panel).
- **Model** — the WebLLM model id, or the browser's Prompt API when present.
- **Embeddings** — `public/kb-export.json`, the `KnowledgeExport` produced by `build-kb`.

Regenerate the knowledge base by editing the `docs` array in
[scripts/build-kb.ts](scripts/build-kb.ts) and re-running `bun run build-kb`.

## Note

If you change the `@sa4drao/umarag` source, rebuild it (`npm run build` in the repo root)
so the linked `dist/` updates.
