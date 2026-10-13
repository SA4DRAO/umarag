import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// A missing /models/* file must 404, never fall back to index.html: WebLLM stores
// whatever it gets in the browser Cache API, so a 200 HTML fallback permanently
// poisons the model cache on every visitor until they clear site data.
const models404 = (): Plugin => ({
  name: "models-404",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? "").split("?")[0]!;
      if (url.startsWith("/models/") && !fs.existsSync(path.join(__dirname, "public", decodeURIComponent(url)))) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      next();
    });
  },
});

// ponytail: exclude the heavy AI libs from dep pre-bundling — they ship their own
// workers/wasm and esbuild pre-bundling them tends to break those.
export default defineConfig({
  plugins: [react(), tailwindcss(), models404()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  optimizeDeps: { exclude: ["@mlc-ai/web-llm", "@huggingface/transformers"] },
  // ponytail: dev server sits behind the tailscale serve reverse proxy, whose
  // Host header isn't localhost — allowlist it to skip vite's DNS-rebind check.
  server: { allowedHosts: ["sa4drao.tail0cf12.ts.net"] },
});
