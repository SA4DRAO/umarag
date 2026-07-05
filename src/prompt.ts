import type { RetrievedSource } from "./types.js";

const DEFAULT_GUARDRAIL =
  "You are a helpful assistant. Answer ONLY using the context below. " +
  "If the answer is not contained in the context, say you don't know rather than guessing. " +
  "Cite sources using [n] notation matching the numbered context entries.";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ponytail: fixed cap keeps ~4k-token on-device context windows from overflowing;
// make it configurable if someone actually hits it.
const MAX_HISTORY_MESSAGES = 8;

export function buildMessages(
  systemPrompt: string | undefined,
  sources: RetrievedSource[],
  query: string,
  history: ChatMessage[] = [],
): ChatMessage[] {
  const context = sources.map((s, i) => `[${i + 1}] ${s.text}`).join("\n\n");
  const base = systemPrompt ?? DEFAULT_GUARDRAIL;

  return [
    { role: "system", content: `${base}\n\nContext:\n${context || "(no matching context found)"}` },
    ...history.slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: query },
  ];
}
