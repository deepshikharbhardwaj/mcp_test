import type { OutputLanguage } from "@/types";

/** Shared by translate-blog.ts (full-language rewrite) and regenerate-section.ts (single-section, single-language rewrite). */
export const OUTPUT_LANGUAGE_DESCRIPTIONS: Record<OutputLanguage, string> = {
  en:
    "Polished, professional English — a well-edited travel blog that reads smoothly regardless of what language the events were originally described in.",
  hi:
    "Natural, everyday Hindi (Devanagari script) that a reader of any age can enjoy — like a well-written Hindi magazine or blog piece. Not stiff, overly Sanskritized \"shuddh\" textbook Hindi; not a word-for-word translation. Common English loanwords that are normal in everyday Hindi speech (e.g. hotel, flight, phone) are fine.",
  hinglish:
    "Gen-Z cool English — lean English-forward (not a heavy 50/50 Hindi-English mix), written the way young urban Indians actually text and talk online today: confident, punchy, a little irreverent, current internet slang used naturally (lowkey, fr, vibe, bestie, no cap) — seasoned with everyday Hindi words/phrases where they'd naturally slip in (yaar, bas, ekdum, scene, matlab). Think a witty travel Instagram caption thread, not a textbook, and never forced or cringey.",
};
