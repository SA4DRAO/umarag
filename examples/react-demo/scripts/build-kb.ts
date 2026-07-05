/**
 * Build a `KnowledgeExport` from the project docs in ../docs — the "ship embeddings"
 * step a team runs in CI. Run with: `bun run build-kb`
 *
 * This is deliberately outside the umarag package: the package consumes the export,
 * it doesn't produce it. This is one concrete way to produce one: one chunk per
 * `## ` section of each markdown file, ids like "configuration#engine-selection".
 */
import { pipeline } from "@huggingface/transformers";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const docsDir = join(root, "docs");

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const sections: { id: string; text: string }[] = [];
for (const file of readdirSync(docsDir).filter((f) => f.endsWith(".md")).sort()) {
  const base = file.replace(/\.md$/, "");
  const body = readFileSync(join(docsDir, file), "utf8");
  // One chunk per `## ` section; the `# ` title line before the first section is dropped.
  for (const match of body.matchAll(/^## (.+)$\n([\s\S]*?)(?=^## |\n*$(?![\s\S]))/gm)) {
    const [, heading, text] = match;
    const clean = text!.trim();
    if (clean) sections.push({ id: `${base}#${slug(heading!)}`, text: `${heading!.trim()}: ${clean}` });
  }
}
if (sections.length === 0) throw new Error(`no ## sections found under ${docsDir}`);

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
