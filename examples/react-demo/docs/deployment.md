# Demo deployment

## How this demo is served

The public demo at umarag.vercel.app is a Vite + React app built to static files and deployed to Vercel from the repository root. The root vercel.json sets the build command to `npm run build:demo` (SDK first, then demo) and the output directory to `examples/react-demo/dist`. Any static host works the same way — Netlify, GitHub Pages, Cloudflare Pages — the deploy is just static files.

WebGPU only runs in secure contexts, so the demo must be served over HTTPS (or localhost). That is the one hard requirement; there is no server component at all. Everything — retrieval, embedding, inference — happens in the visitor's browser.

## Model weights: self-hosted vs HuggingFace

The demo ships a catalog of small MLC models (Gemma, Llama 3.2, Qwen2.5, SmolLM2 — see src/lib/models.ts). At startup it probes `/models/<id>/resolve/main/mlc-chat-config.json`:

- If the origin serves it (a local checkout with the weight store symlinked into public/models), WebLLM loads weights from that origin via a custom appConfig — zero third-party requests.
- If the probe 404s (e.g. the Vercel deployment, which does not carry the multi-GB weight directory), the demo omits the appConfig and WebLLM resolves the model id from its own prebuilt registry, fetching weights from HuggingFace and caching them in the browser's Cache API after first load.

Either way the visitor's browser ends up running the same model; only the first download source differs.

## Rebuilding the demo

From the repository root: `npm install` (builds the SDK via the prepare script), then from examples/react-demo: `npm run build-kb` to regenerate the knowledge export from the markdown files in docs/, then `npm run build`. If the umarag SDK source changed, run `npm run build` at the repo root first — the demo consumes the SDK via a local file: link.
