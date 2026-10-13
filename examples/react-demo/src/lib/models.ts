// Single source of truth for the model catalog. Two serving modes:
//  1. Self-hosted: weights live in ../models/<id>/resolve/main/ (see ../models/README.md),
//     symlinked into public/ and dist/. Used when the origin actually serves /models/*.
//  2. HuggingFace: when /models/ isn't served (e.g. a static host without the weights),
//     we omit appConfig and let WebLLM pull weights + libs from its own prebuilt registry.
// wasm libs in mode 1 must match @mlc-ai/web-llm 0.2.84 (binary-mlc-llm-libs v0_2_84).

export type ModelEntry = {
  id: string;
  label: string;
  /** wasm filename in ../models/ — not always derivable from id (Qwen2.5 uses the Qwen2 lib) */
  lib: string;
  needsF16: boolean;
  /** approx VRAM per WebLLM prebuilt config, MB */
  vram: number;
};

export const MODELS: ModelEntry[] = [
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B · f16", lib: "gemma-2-2b-it-q4f16_1_cs1k-webgpu.wasm", needsF16: true, vram: 1895 },
  { id: "gemma-2-2b-it-q4f32_1-MLC", label: "Gemma 2 2B · f32", lib: "gemma-2-2b-it-q4f32_1_cs1k-webgpu.wasm", needsF16: false, vram: 2509 },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B · f16", lib: "Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm", needsF16: true, vram: 879 },
  { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", label: "Llama 3.2 1B · f32", lib: "Llama-3.2-1B-Instruct-q4f32_1_cs1k-webgpu.wasm", needsF16: false, vram: 1129 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B · f16", lib: "Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm", needsF16: true, vram: 1630 },
  { id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 1.5B · f32", lib: "Qwen2-1.5B-Instruct-q4f32_1_cs1k-webgpu.wasm", needsF16: false, vram: 1889 },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B · f16", lib: "SmolLM2-1.7B-Instruct-q4f16_1_cs1k-webgpu.wasm", needsF16: true, vram: 1774 },
  { id: "SmolLM2-1.7B-Instruct-q4f32_1-MLC", label: "SmolLM2 1.7B · f32", lib: "SmolLM2-1.7B-Instruct-q4f32_1_cs1k-webgpu.wasm", needsF16: false, vram: 2692 },
  { id: "gemma3-1b-it-q4f16_1-MLC", label: "Gemma 3 1B · f16", lib: "gemma3-1b-it-q4f16_1_cs1k-webgpu.wasm", needsF16: true, vram: 711 },
];

const record = (m: ModelEntry) => ({
  model: `${location.origin}/models/${m.id}/resolve/main/`,
  model_id: m.id,
  model_lib: `${location.origin}/models/${m.lib}`,
  overrides: { context_window_size: 4096 },
  ...(m.needsF16 ? { required_features: ["shader-f16"] } : {}),
});

// A deployment that doesn't carry the ~1.4 GB weight directory (e.g. a static
// host) must not point WebLLM at /models/* — probe once at startup and fall
// back to WebLLM's own prebuilt registry (weights from HuggingFace) instead.
let selfHosted: boolean | null = null;

export async function weightsAreSelfHosted(): Promise<boolean> {
  if (selfHosted === null) {
    const probe = MODELS[0]!;
    selfHosted = await fetch(`/models/${probe.id}/resolve/main/mlc-chat-config.json`, {
      method: "HEAD",
    })
      .then((r) => r.ok && (r.headers.get("content-type") ?? "").includes("json"))
      .catch(() => false);
  }
  return selfHosted;
}

/** undefined => WebLLM uses its built-in model registry (HuggingFace-hosted weights). */
export async function getAppConfig() {
  return (await weightsAreSelfHosted()) ? { model_list: MODELS.map(record) } : undefined;
}

/** best default for the device: first entry the adapter can run */
export const pickDefault = (shaderF16: boolean) =>
  (MODELS.find((m) => shaderF16 || !m.needsF16) ?? MODELS[0]!).id;
