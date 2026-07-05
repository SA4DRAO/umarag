import { build } from "esbuild";

// ponytail: one esbuild call. Heavy libs stay external so the consumer's
// bundler resolves them once and can lazy-load WebLLM only when it's used.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["@orama/orama", "@huggingface/transformers", "@mlc-ai/web-llm"],
});

console.log("built dist/index.js");
