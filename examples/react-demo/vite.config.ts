import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ponytail: exclude the heavy AI libs from dep pre-bundling — they ship their own
// workers/wasm and esbuild pre-bundling them tends to break those.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  optimizeDeps: { exclude: ["@mlc-ai/web-llm", "@huggingface/transformers"] },
});
