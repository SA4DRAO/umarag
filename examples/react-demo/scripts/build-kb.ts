/**
 * Build a `KnowledgeExport` from the project's own GitHub documentation — the root
 * README.md (the repo front page), this example's README.md, and the docs/ set.
 * This is the "ship embeddings" step a team runs in CI. Run with: `npm run build-kb`
 *
 * This is deliberately outside the umarag package: the package consumes the export,
 * it doesn't produce it. This is one concrete way to produce one: one chunk per
 * `## ` section of each markdown file, ids like "readme#install" or
 * "docs/getting-started#installation".
 */
import { pipeline } from "@huggingface/transformers";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "Xenova/all-MiniLM-L6-v2";

// The Guardrails shipped alongside the model + embeddings.
const SYSTEM_PROMPT = [
  "You are the documentation assistant for umarag, a client-side RAG SDK that runs",
  "retrieval and LLM inference entirely in the browser.",
  "Answer ONLY using the provided context. If the answer isn't in the context, say you",
  "don't know and point the user to the project README. Never invent APIs, config fields,",
  "or model names. Cite the context entry you used with [n].",
].join(" ");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..", "..");
const docsDir = join(root, "docs");

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The GitHub documentation surface: repo front-page README, this example's README,
// and the docs/ set. models/README.md is intentionally excluded (internal weight-store
// bookkeeping, not user-facing docs).
const sources: { path: string; base: string }[] = [
  { path: join(repoRoot, "README.md"), base: "readme" },
  { path: join(root, "README.md"), base: "demo" },
  ...readdirSync(docsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ path: join(docsDir, f), base: `docs/${f.replace(/\.md$/, "")}` })),
].filter((s) => existsSync(s.path));

const sections: { id: string; text: string }[] = [];
for (const { path, base } of sources) {
  const body = readFileSync(path, "utf8");
  // One chunk per `## ` section; the `# ` title line before the first section is dropped.
  for (const match of body.matchAll(/^## (.+)$\n([\s\S]*?)(?=^## |\n*$(?![\s\S]))/gm)) {
    const [, heading, text] = match;
    const clean = text!.trim();
    if (clean) sections.push({ id: `${base}#${slug(heading!)}`, text: `${heading!.trim()}: ${clean}` });
  }
}
if (sections.length === 0) throw new Error(`no ## sections found in sources: ${sources.map((s) => s.path).join(", ")}`);

const embed = await pipeline("feature-extraction", MODEL);

const chunks = [];
for (const s of sections) {
  const out = await embed(s.text, { pooling: "mean", normalize: true });
  chunks.push({ id: s.id, text: s.text, embedding: Array.from(out.data as Float32Array) });
}

const kbExport = {
  schemaVersion: 1,
  embeddingModel: MODEL,
  embeddingDim: chunks[0]!.embedding.length,
  systemPrompt: SYSTEM_PROMPT,
  chunks,
};

const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "kb-export.json");
writeFileSync(outPath, JSON.stringify(kbExport));

console.log(`wrote ${outPath} — ${chunks.length} chunks from ${new Set(chunks.map((c) => c.id.split("#")[0])).size} docs, dim ${kbExport.embeddingDim}`);
