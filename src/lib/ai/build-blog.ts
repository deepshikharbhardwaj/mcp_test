import type { BlogDocument, BlogStyle } from "@/types";
import { newId } from "@/lib/utils/id";
import type { GeneratedBlog } from "./types";

/** Converts a fresh AI response into a persistable BlogDocument with real ids. */
export function buildBlogDocument(dayId: string, generated: GeneratedBlog, style: BlogStyle): BlogDocument {
  const now = new Date().toISOString();
  return {
    id: newId(),
    dayId,
    title: generated.title,
    style,
    version: 0,
    createdAt: now,
    updatedAt: now,
    sections: generated.sections.map((s, i) => ({
      id: newId(),
      blogId: "",
      order: i,
      heading: s.heading,
      paragraphs: s.paragraphs,
      userEdited: false,
      imagePlacement: s.imageSuggestion
        ? {
            id: newId(),
            sectionId: "",
            imageId: null,
            suggestion: s.imageSuggestion,
            caption: null,
          }
        : null,
    })),
  };
}
