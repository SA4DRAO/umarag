# Local model store

Served at `/models/*` (symlinked into `dist/` after each build: `ln -sfn ../models dist/models`).

- `gemma-2-2b-it-q4f16_1-MLC/resolve/main/` — weights from
  https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC (the `resolve/main/` nesting is
  required: WebLLM appends it to any model URL that lacks it). Needs `shader-f16`.
- `gemma-2-2b-it-q4f32_1-MLC/resolve/main/` — same weights, f32 build for GPUs without
  `shader-f16`; the widget picks between them at runtime by probing the adapter.
- `*_cs1k-webgpu.wasm` — model libs from mlc-ai/binary-mlc-llm-libs
  `web-llm-models/v0_2_84/base/` (must match the installed @mlc-ai/web-llm version)
