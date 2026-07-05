# Demo deployment

## How this demo is served

The demo is a Vite + React app built to static files and served by a plain Python http.server on 127.0.0.1:8787, exposed to the private tailnet over HTTPS with `tailscale serve --bg --https=10000 8787`. Tailscale provides valid TLS certificates for the tailnet hostname, which matters because WebGPU only works in secure contexts. Any device joining the tailnet — Mac, Windows, Linux, Android, iPhone — can open the demo URL and run the full RAG stack in its own browser.

## Model files on disk

The Gemma weights live in the examples/react-demo/models/ directory (both q4f16 and q4f32 builds plus their compiled wasm libs) and are symlinked into dist/ after each build with `ln -sfn ../models dist/models`, since vite build wipes dist. They were downloaded once from HuggingFace with curl against resolve/main URLs and size-verified against the repo manifest.

## Rebuilding the demo

From examples/react-demo: `bun install`, then `bun run build-kb` to regenerate the knowledge export from the markdown files in docs/, then `bun run build`, then recreate the models symlink. If the umarag SDK source changed, run `npm run build` at the repo root first — the demo consumes the SDK via a local file: link.
