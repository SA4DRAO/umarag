import { describe, it, expect } from "vitest";
import { buildMessages, type ChatMessage } from "../src/prompt.js";
import type { RetrievedSource } from "../src/types.js";

const sources: RetrievedSource[] = [
  { id: "a", text: "reset your password from settings", score: 0.9 },
  { id: "b", text: "configure webhooks in the dashboard", score: 0.5 },
];

describe("buildMessages", () => {
  it("numbers context entries and appends them to the system prompt", () => {
    const messages = buildMessages("You are Acme's bot.", sources, "How do I reset my password?");
    expect(messages[0]!.role).toBe("system");
    expect(messages[0]!.content).toContain("You are Acme's bot.");
    expect(messages[0]!.content).toContain("[1] reset your password from settings");
    expect(messages[0]!.content).toContain("[2] configure webhooks in the dashboard");
    expect(messages[1]).toEqual({ role: "user", content: "How do I reset my password?" });
  });

  it("falls back to the default guardrail when no system prompt is given", () => {
    const messages = buildMessages(undefined, [], "anything");
    expect(messages[0]!.content).toContain("Answer ONLY using the context below");
    expect(messages[0]!.content).toContain("(no matching context found)");
  });

  it("keeps only the most recent 8 history messages between system and the new query", () => {
    const history: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `m${i}`,
    }));
    const messages = buildMessages(undefined, [], "new q", history);
    expect(messages).toHaveLength(10); // system + 8 history + new user turn
    expect(messages[1]!.content).toBe("m4");
    expect(messages.at(-1)).toEqual({ role: "user", content: "new q" });
  });
});
