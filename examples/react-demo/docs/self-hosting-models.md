# Self-hosting model weights

## Why self-host

By default WebLLM downloads model weights from HuggingFace. Passing webllmAppConfig lets you serve the weights from your own origin instead — useful for air-gapped networks, private tailnets, faster LAN loads, and guaranteeing exactly which model binary runs. The demo you are reading this in serves Gemma 2 2B from the same machine that hosts the page; no model CDN is involved at load time.

## Directory layout and the resolve/main rule

Mirror the HuggingFace layout on disk: the weight files (mlc-chat-config.json, ndarray-cache.json, params_shard_*.bin, tokenizer files) must live under `<model-id>/resolve/main/`, and the model URL in webllmAppConfig must end with a slash. This is because WebLLM appends "resolve/main/" to any model URL that doesn't already contain a "/resolve/<revision>/" segment. The model_lib field points to the compiled WebGPU wasm for the model architecture — it must come from the binary-mlc-llm-libs release matching your installed @mlc-ai/web-llm version (for 0.2.84: web-llm-models/v0_2_84/base/).

## Example config

`webllmAppConfig: { model_list: [{ model: location.origin + "/models/gemma-2-2b-it-q4f16_1-MLC/resolve/main/", model_id: "gemma-2-2b-it-q4f16_1-MLC", model_lib: location.origin + "/models/gemma-2-2b-it-q4f16_1_cs1k-webgpu.wasm" }] }` — pass it together with webllmModel set to the same model_id and engine set to 'webllm'.

## Picking a quantization per device

The q4f16 build (~1.4 GB) requires the GPU to expose the shader-f16 WebGPU feature; the q4f32 build (same weights, also ~1.4 GB on disk, more VRAM at runtime) runs everywhere WebGPU does. The demo hosts both and probes `(await navigator.gpu.requestAdapter()).features.has("shader-f16")` at load time to pick — copy that pattern for maximum device coverage. Gemma 2 2B q4f16 needs roughly 1.9 GB of GPU memory, q4f32 roughly 2.5 GB.

## Which models can run

Any model in WebLLM's prebuilt registry works out of the box (Llama 3.x, Gemma 2, Gemma 3 1B, Phi, Qwen, Mistral families). A model only runs if a compiled WebGPU wasm exists for its architecture in your WebLLM version — that is why Gemma 3n E2B and other very new architectures are not available: no MLC-compiled build exists for them yet. For small on-device use, gemma-2-2b-it (2B-class) is the workhorse and gemma-3-1b-it (~700 MB) is the light option for weaker phones.
