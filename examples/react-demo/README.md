# umarag demo — React + Vite

The live site at **[umarag.vercel.app](https://umarag.vercel.app)**: a marketing page
with an embedded docs assistant that dogfoods the SDK (linked locally via `file:../..`).
It demonstrates the three things a team ships: **Guardrails + Model + Embeddings**.

## Run locally

```bash
# from the repo root:
npm install            # installs workspaces + builds the SDK (prepare script)
cd examples/react-demo
npm run build-kb       # regenerates public/kb-export.json from docs/*.md (real MiniLM embeddings)
npm run dev            # http://localhost:5173
```

Open in a **WebGPU-capable browser** (current Chrome desktop/Android, or Safari/iOS 26+)
to use the WebLLM engine; the built-in Prompt API engine needs Chrome with the
`chrome://flags/#optimization-guide-on-device-model` + `#prompt-api-for-gemini-nano`
flags enabled.

### Self-hosted weights (optional)

The demo can serve model weights from its own origin instead of HuggingFace. Place
weights under `models/` mirroring the HF layout (see [`models/README.md`](models/README.md))
and symlink them into `public/`:

```bash
ln -sfn ../models public/models
```

At startup the demo probes `/models/<id>/resolve/main/mlc-chat-config.json`: if the
origin serves it, weights load from disk; otherwise it falls back to WebLLM's
prebuilt registry (HuggingFace). That's why the deployed Vercel site — which doesn't
carry the ~8 GB weight store — still runs the full model, fetched from HF and cached
in the browser.

## The three shipped things

- **Guardrails** — the `systemPrompt` baked into the export by `scripts/build-kb.ts`.
- **Model** — the WebLLM model id (pickable live in the widget), or the browser's
  Prompt API when present. Engine switching is live; the KB stays loaded.
- **Embeddings** — `public/kb-export.json`, the `KnowledgeExport` produced by `build-kb`.

Regenerate the knowledge base by editing the markdown in `docs/` and re-running
`npm run build-kb`.

## Deploying

The repo root's `vercel.json` builds this demo (`npm run build:demo`) and deploys
`examples/react-demo/dist`. WebGPU requires a secure context, so deploy over HTTPS
(any static host works — Vercel, Netlify, GitHub Pages + a custom domain).

## Note

If you change the `@sa4drao/umarag` source, rebuild it (`npm run build` in the repo
root) so the linked `dist/` updates.
