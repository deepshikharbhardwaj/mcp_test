import { MockAiProvider } from "./mock-provider";
import { AnthropicAiProvider } from "./anthropic-provider";
import { GeminiAiProvider } from "./gemini-provider";
import type { AiProvider } from "./types";

/**
 * Server-only provider selection. Import this from API routes only — it
 * reads `process.env`, which is not available (and must never be exposed)
 * in browser code.
 *
 * Checked in order: Gemini, then Anthropic, then the offline mock. Set
 * whichever key you actually have in `.env.local` — only one is needed.
 */
export function getAiProvider(): AiProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) return new GeminiAiProvider(geminiKey, process.env.GEMINI_MODEL);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return new AnthropicAiProvider(anthropicKey);

  return new MockAiProvider();
}

export type { AiProvider, ExtractedEvents, GeneratedBlog, GeneratedSection } from "./types";
