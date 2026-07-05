# Troubleshooting

## WebGPU requirements per platform

umarag's WebLLM engine requires WebGPU; there is deliberately no CPU fallback because CPU inference of a 1B+ model in a browser is too slow to be a usable product. WebGPU ships by default in Chrome and Edge on Windows and macOS (since Chrome 113), in Chrome on Android for qualified devices (since Chrome 121), and in Safari on macOS, iOS, iPadOS and visionOS since Safari 26 / iOS 26. On Linux, Chrome needs chrome://flags/#enable-unsafe-webgpu and chrome://flags/#enable-vulkan enabled, then a relaunch.

## GPU blocklist: adapter is null even though chrome://gpu says enabled

chrome://gpu can report "WebGPU: Hardware accelerated" while web pages still get null from navigator.gpu.requestAdapter() — Chrome keeps a blocklist of GPU/driver combinations for page-level access. The fix is enabling chrome://flags/#enable-unsafe-webgpu and relaunching Chrome. This is common on Android devices that are not in Chrome's qualified list. umarag surfaces this case as EdgeChatUnsupportedError with a "no adapter granted" message.

## iPhone and iPad

WebGPU is available from iOS/iPadOS 26 onward — update the OS if the demo reports no adapter. Note that every browser on iOS (including Chrome and Firefox) is WebKit underneath outside the EU, so updating iOS, not the browser app, is what matters. The Prompt API (Gemini Nano) does not exist on iOS; WebGPU is the only engine path there.

## shader-f16 missing

If the adapter exists but lacks the shader-f16 feature, a q4f16 model will refuse to load. Use the q4f32 build of the same model, or probe the adapter first and pick the right variant. The demo ships a /gpu-check.html page that prints the adapter name, shader-f16 support, and buffer limits for any device — open it on a failing device to see exactly what it supports.

## First load is slow

The first load streams the model weights (~1.4 GB for Gemma 2 2B) and caches them in browser storage; subsequent loads read from cache and take seconds. The embedding model (~25 MB) is fetched from the HuggingFace CDN on first use and also cached. If loading stalls mid-way, a retry resumes safely — init() failures are not cached.
