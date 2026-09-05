import { MockAiProvider } from "./mock-provider";
import { AnthropicAiProvider } from "./anthropic-provider";
import type { AiProvider } from "./types";

/**
 * Server-only provider selection. Import this from API routes only — it
 * reads `process.env`, which is not available (and must never be exposed)
 * in browser code.
 */
export function getAiProvider(): AiProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) return new AnthropicAiProvider(apiKey);
  return new MockAiProvider();
}

export type { AiProvider, ExtractedEvents, GeneratedBlog, GeneratedSection } from "./types";
