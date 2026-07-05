import { ChatWidget } from "@/components/ChatWidget";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Cpu, Database, ServerOff, Lock, Boxes, ArrowDownRight, Package } from "lucide-react";

const INSTALL = "npm install @sa4drao/umarag @orama/orama @huggingface/transformers";

const CLIENT_SNIPPET = `import { EdgeChat, checkCompatibility } from "@sa4drao/umarag";

const compat = await checkCompatibility(); // { webllm, promptApi, shaderF16 }
const chat = new EdgeChat({
  knowledgeUrl: "https://cdn.acme.com/kb-export.json",
  engine: "auto", // or force "webllm" / "prompt-api"; switchEngine() swaps live
  // optional: pin a model + serve its weights from your own origin
  // webllmModel: "...", webllmAppConfig: { model_list: [...] },
  onProgress: ({ text, progress }) => updateLoadingUI(text, progress),
});
await chat.init(); // retryable on failure; chat.dispose() frees the GPU

// history = prior { role, content } turns — the assistant's memory
const { sources, stream } = await chat.stream("How do I authenticate?", history);
for await (const delta of stream) appendToUI(delta); // grounded, 100% on-device`;

const THINGS = [
  {
    icon: ShieldCheck,
    title: "Guardrails",
    body: "A system prompt that pins the assistant to your knowledge base — no hallucinating past your docs.",
  },
  {
    icon: Cpu,
    title: "Model",
    body: "A WebLLM model over WebGPU — from HuggingFace or self-hosted on your own origin — or the browser's built-in Prompt API. checkCompatibility() tells you what each device can run.",
  },
  {
    icon: Database,
    title: "Embeddings",
    body: "A static vector export from your own pipeline, hosted on any CDN. Ship it once, hydrate it client-side.",
  },
];

const FEATURES = [
  { icon: ServerOff, title: "Zero backend", body: "No inference server, no API keys, no per-token bill. Static files on a CDN." },
  { icon: Lock, title: "Private by default", body: "Queries and documents never leave the tab. Everything runs on-device." },
  { icon: Boxes, title: "Framework-agnostic", body: "Plain ESM classes. Drop into React, Vue, Svelte, or vanilla JS." },
];

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center bg-primary text-primary-foreground">
              <Boxes className="size-4" />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight">umarag</span>
          </div>
          <a
            href="https://www.npmjs.com/package/@sa4drao/umarag"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Package className="size-4" /> npm
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Badge variant="secondary" className="mb-5 uppercase tracking-wider">
          On-device RAG · v0.4 pre-release
        </Badge>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight text-balance sm:text-6xl">
          Ship a chatbot that runs <span className="text-primary">entirely in the browser</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
          <span className="font-mono text-foreground">umarag</span> is a client-side RAG runtime. Give it a
          hosted vector export and it does retrieval and multi-turn, grounded LLM generation on-device — no
          server, no API key, no data leaving the tab.
        </p>

        <div className="mx-auto mt-8 max-w-2xl overflow-x-auto border border-border bg-muted/50 px-4 py-3 text-left">
          <code className="font-mono text-sm text-muted-foreground">
            <span className="text-primary">$</span> {INSTALL}
          </code>
        </div>

        <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
          Try the live assistant <ArrowDownRight className="size-4" /> bottom-right — it answers questions
          about umarag itself, remembers the conversation, and lets you switch engines and models live, with
          Gemma 2 2B served from this very origin
        </p>
      </section>

      {/* three things */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Ship three things
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
          Everything a team needs to hand off — nothing to operate.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {THINGS.map((t) => (
            <Card key={t.title} className="border-border p-6">
              <t.icon className="mb-4 size-6 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">{t.title}</h3>
              <p className="text-sm text-muted-foreground">{t.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">A few lines on the client</h2>
        <div className="mx-auto max-w-3xl overflow-x-auto border border-border bg-muted/50 p-5">
          <pre className="font-mono text-sm leading-relaxed text-foreground">{CLIENT_SNIPPET}</pre>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-muted-foreground">
          The knowledge export is produced by your own build pipeline and hosted as a static file. umarag
          consumes it — it doesn't run a vector database or an inference server for you.
        </p>
      </section>

      {/* features */}
      <section className="mx-auto max-w-5xl px-6 py-8 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border p-6">
              <f.icon className="mb-4 size-6 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span className="font-mono">@sa4drao/umarag</span>
          <span>MIT · runs on WebGPU / Prompt API</span>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
