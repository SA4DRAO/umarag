# Local model store

Served at `/models/*` (in dev via the `public/models` symlink; after `vite build`,
re-create `dist/models`: `ln -sfn ../models dist/models`).

Each `<model-id>/resolve/main/` holds weights mirrored from
`https://huggingface.co/mlc-ai/<model-id>` (the `resolve/main/` nesting is required:
WebLLM appends it to any model URL that lacks it). The flat `*-webgpu.wasm` files are
model libs from mlc-ai/binary-mlc-llm-libs `web-llm-models/v0_2_84/base/` and must
match the installed @mlc-ai/web-llm version (0.2.84).

The catalog the demo actually uses (ids, lib filenames, f16 requirements) lives in
`../src/lib/models.ts` — keep this directory and that file in sync. Note Qwen2.5
weights run on the Qwen2 wasm libs; lib filenames are not derivable from model ids.

f16 builds need the `shader-f16` WebGPU feature; f32 builds run anywhere WebGPU does.
Weights were fetched with plain curl against HF `resolve/main` URLs (no git-lfs on
this machine) — `scripts/` in the session scratchpad verified shard sizes against
`ndarray-cache.json`.
