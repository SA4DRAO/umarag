import { useEffect, useRef, useState } from "react";
import { EdgeChat, checkCompatibility, type CompatibilityReport, type EngineKind } from "@sa4drao/umarag";
import { MessageCircle, X, Send, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "ready" | "error";
type Message = { role: "user" | "assistant"; content: string; sources?: string[] };

const KNOWLEDGE_URL = "/kb-export.json";
// Gemma 2 2B served from this origin (see ../models/) — no CDN at LLM load time.
// Two builds of the same weights: q4f16 for GPUs with shader-f16, q4f32 for the rest.
const record = (id: string, extra: object) => ({
  model: `${location.origin}/models/${id}/resolve/main/`,
  model_id: id,
  model_lib: `${location.origin}/models/${id.replace("-MLC", "_cs1k-webgpu.wasm")}`,
  overrides: { context_window_size: 4096 },
  ...extra,
});
const APP_CONFIG = {
  model_list: [
    record("gemma-2-2b-it-q4f16_1-MLC", { required_features: ["shader-f16"] }),
    record("gemma-2-2b-it-q4f32_1-MLC", {}),
  ],
};

const MODES: { value: EngineKind; label: string; blurb: string }[] = [
  { value: "auto", label: "Auto", blurb: "picks the best engine for this device" },
  { value: "webllm", label: "WebLLM", blurb: "Gemma 2 2B over WebGPU (~1.4 GB, cached after first load)" },
  { value: "prompt-api", label: "Built-in", blurb: "the browser's built-in model (Gemini Nano) — no download" },
];

// Both entries in APP_CONFIG above. f32 is the workaround for GPUs whose drivers
// advertise shader-f16 but miscompute it (garbled output on some Android devices).
const MODELS = [
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B · f16", needsF16: true },
  { id: "gemma-2-2b-it-q4f32_1-MLC", label: "Gemma 2 2B · f32", needsF16: false },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ text: "", pct: 0 });
  const [engine, setEngine] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<EngineKind>("auto");
  const [model, setModel] = useState<string>("");
  const [compat, setCompat] = useState<CompatibilityReport | null>(null);
  const [switching, setSwitching] = useState(false);

  const chatRef = useRef<EdgeChat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !compat) {
      checkCompatibility().then((c) => {
        setCompat(c);
        setModel(c.shaderF16 ? MODELS[0]!.id : MODELS[1]!.id);
      });
    }
  }, [open, compat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function load(engine: EngineKind = mode, webllmModel: string = model) {
    setStatus("loading");
    setError("");
    setProgress({ text: "Checking device compatibility…", pct: 0 });
    try {
      const c = compat ?? (await checkCompatibility());
      setCompat(c);
      if (!c.webllm.supported && !c.promptApi.supported) {
        throw new Error(
          `${c.webllm.reason} ${c.promptApi.reason} ` +
            "Chrome: enable chrome://flags/#enable-unsafe-webgpu (Linux also needs #enable-vulkan) and relaunch. " +
            "Safari/iOS: WebGPU ships by default from iOS/iPadOS 26 — update if older.",
        );
      }
      // A webllm model is always configured, so SDK 'auto' prefers our self-hosted
      // Gemma and falls back to the built-in Prompt API when WebGPU can't deliver.
      const chat = new EdgeChat({
        knowledgeUrl: KNOWLEDGE_URL,
        engine,
        webllmModel: webllmModel || (c.shaderF16 ? MODELS[0]!.id : MODELS[1]!.id),
        webllmAppConfig: APP_CONFIG,
        onProgress: (r) => setProgress({ text: r.text, pct: Math.round(r.progress * 100) }),
      });
      await chat.init();
      chatRef.current = chat;
      setEngine(chat.engineKind);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      setStatus("error");
    }
  }

  async function switchModel(next: string) {
    setModel(next);
    if (status !== "ready") return; // picked up by the next load
    // Model lives in the EdgeChat config, so swap = dispose + reload. Frees the
    // old model's GPU memory before the new one loads — phones can't hold two.
    const old = chatRef.current;
    chatRef.current = null;
    setEngine(null);
    await old?.dispose();
    await load(mode, next);
  }

  async function switchMode(next: EngineKind) {
    setMode(next);
    const chat = chatRef.current;
    if (!chat || status !== "ready") return;
    setSwitching(true);
    setProgress({ text: "Switching engine…", pct: 0 });
    try {
      setEngine(await chat.switchEngine(next));
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Engine switch failed: ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setSwitching(false);
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || !chatRef.current || busy) return;
    setInput("");
    setBusy(true);
    // Prior turns are the assistant's memory — the SDK caps how many go in the prompt.
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

    try {
      const { sources, stream } = await chatRef.current.stream(q, history);
      const sourceIds = sources.map((s) => s.id);
      for await (const delta of stream) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1]!;
          next[next.length - 1] = { ...last, content: last.content + delta, sources: sourceIds };
          return next;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Open assistant"
      >
        <MessageCircle className="size-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col border border-border bg-card text-card-foreground shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[380px]">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="text-sm font-semibold">umarag docs assistant</span>
        </div>
        <div className="flex items-center gap-2">
          {engine && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {engine}
            </Badge>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-80 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* engine mode toggle */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {MODES.map(({ value, label }) => {
          const support =
            value === "webllm" ? compat?.webllm : value === "prompt-api" ? compat?.promptApi : undefined;
          const unsupported = support ? !support.supported : false;
          return (
            <button
              key={value}
              onClick={() => switchMode(value)}
              disabled={unsupported || status === "loading" || switching || busy}
              title={unsupported ? support?.reason : undefined}
              className={cn(
                "border px-2 py-1 text-[11px] uppercase tracking-wide transition-colors",
                mode === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
                unsupported && "cursor-not-allowed opacity-40 line-through",
              )}
            >
              {label}
            </button>
          );
        })}
        {compat && (
          <span className="ml-auto text-[10px] text-muted-foreground" title="Backend compatibility on this device">
            gpu {compat.webllm.supported ? (compat.shaderF16 ? "✓ f16" : "✓") : "✗"} · built-in{" "}
            {compat.promptApi.supported ? "✓" : "✗"}
          </span>
        )}
      </div>

      {/* WebLLM model picker */}
      {compat?.webllm.supported && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <label
            htmlFor="model-select"
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            model
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => switchModel(e.target.value)}
            disabled={status === "loading" || switching || busy}
            className="flex-1 border border-border bg-background px-2 py-1 text-[11px] text-foreground"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={m.needsF16 && !compat.shaderF16}>
                {m.label}
                {m.needsF16 && !compat.shaderF16 ? " — needs shader-f16" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* body */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {status === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <ShieldCheck className="size-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              Runs entirely in your browser — no server, no API key.
            </p>
            <ul className="space-y-1 text-left text-xs text-muted-foreground">
              {MODES.map(({ label, blurb }) => (
                <li key={label}>
                  <span className="font-medium text-foreground">{label}</span> — {blurb}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Pick a mode above (crossed-out modes can't run on this device), then start. You can switch modes
              anytime — the knowledge base stays loaded.
            </p>
            <Button onClick={() => load()} className="w-full">
              Start assistant
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="h-1.5 w-full overflow-hidden bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{progress.text || "Loading…"}</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground">
              This demo needs WebGPU (current Chrome) or the built-in Prompt API.
            </p>
            <Button variant="outline" onClick={() => load()}>
              Retry
            </Button>
          </div>
        )}

        {status === "ready" && messages.length === 0 && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ask about umarag — e.g. “How do I self-host model weights?” or “What is in a knowledge
            export?”
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background",
              )}
            >
              {m.content || <span className="animate-pulse text-muted-foreground">▍</span>}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
                  sources: {m.sources.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* composer */}
      {status === "ready" && (
        <div className="border-t border-border">
          {switching && (
            <p className="flex items-center gap-2 px-3 pt-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {progress.text || "Switching engine…"}
            </p>
          )}
          <div className="flex items-center gap-2 p-3">
            <Input
              value={input}
              placeholder="Ask a question…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={busy || switching}
            />
            <Button size="icon" onClick={send} disabled={busy || switching}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
