import type { BlogDocument, BlogLanguageVariant, BlogStyle, ImagePlacement, OutputLanguage } from "@/types";
import { newId } from "@/lib/utils/id";
import type { GeneratedBlog, TranslatedBlog } from "./types";

/**
 * Assembles the full multi-language BlogDocument from one canonical English
 * generation plus its Hindi/Hinglish translations. Section ids are minted
 * once here and shared across all three variants, which is what keeps a
 * photo placed against "section 2" meaningful no matter which language is
 * currently being viewed.
 */
export function buildBlogDocument(
  dayId: string,
  english: GeneratedBlog,
  translations: Record<Exclude<OutputLanguage, "en">, TranslatedBlog>,
  style: BlogStyle,
  activeLanguage: OutputLanguage
): BlogDocument {
  const now = new Date().toISOString();
  const sectionIds = english.sections.map(() => newId());

  function buildVariant(title: string, sections: Array<{ heading: string; paragraphs: string[] }>): BlogLanguageVariant {
    return {
      title,
      titleUserEdited: false,
      sections: sections.map((s, i) => ({
        id: sectionIds[i]!,
        order: i,
        heading: s.heading,
        paragraphs: s.paragraphs,
        userEdited: false,
      })),
    };
  }

  const imagePlacements: ImagePlacement[] = english.sections
    .map((s, i): ImagePlacement | null =>
      s.imageSuggestion
        ? {
            id: newId(),
            sectionId: sectionIds[i]!,
            imageId: null,
            suggestion: s.imageSuggestion,
            caption: null,
          }
        : null
    )
    .filter((p): p is ImagePlacement => p !== null);

  return {
    id: newId(),
    dayId,
    style,
    activeLanguage,
    version: 0,
    createdAt: now,
    updatedAt: now,
    imagePlacements,
    variants: {
      en: buildVariant(english.title, english.sections),
      hi: buildVariant(translations.hi.title, translations.hi.sections),
      hinglish: buildVariant(translations.hinglish.title, translations.hinglish.sections),
    },
  };
}
