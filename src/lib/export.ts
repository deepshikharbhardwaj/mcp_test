import type { BlogDocument } from "@/types";
import type { GeneratedTripStory } from "@/lib/ai/types";

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function dayBlogToMarkdown(blog: BlogDocument): string {
  const lines = [`# ${blog.title}`, ""];
  for (const section of blog.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const p of section.paragraphs) lines.push(p, "");
    if (section.imagePlacement) {
      const label = section.imagePlacement.caption || section.imagePlacement.suggestion;
      lines.push(`![${label}](image-placeholder: ${section.imagePlacement.suggestion})`, "");
    }
  }
  return lines.join("\n");
}

export function dayBlogToHtml(blog: BlogDocument, tripName: string): string {
  const sections = blog.sections
    .map((s) => {
      const paragraphs = s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
      const image = s.imagePlacement
        ? `<figure><div class="placeholder">📷 ${escapeHtml(s.imagePlacement.suggestion)}</div>${
            s.imagePlacement.caption ? `<figcaption>${escapeHtml(s.imagePlacement.caption)}</figcaption>` : ""
          }</figure>`
        : "";
      return `<section><h2>${escapeHtml(s.heading)}</h2>${paragraphs}${image}</section>`;
    })
    .join("\n");

  return htmlDocument(escapeHtml(blog.title), tripName, sections);
}

export function tripStoryToMarkdown(story: GeneratedTripStory): string {
  const lines = [`# ${story.title}`, "", story.introduction, ""];
  for (const s of story.sections) {
    lines.push(`## ${s.heading}`, "");
    for (const p of s.paragraphs) lines.push(p, "");
  }
  lines.push(story.conclusion);
  return lines.join("\n");
}

export function tripStoryToHtml(story: GeneratedTripStory, tripName: string): string {
  const sections = story.sections
    .map((s) => `<section><h2>${escapeHtml(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}</section>`)
    .join("\n");
  const body = `<p class="intro">${escapeHtml(story.introduction)}</p>${sections}<p class="conclusion">${escapeHtml(story.conclusion)}</p>`;
  return htmlDocument(escapeHtml(story.title), tripName, body);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlDocument(title: string, tripName: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — ${escapeHtml(tripName)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: Georgia, 'Iowan Old Style', serif; background: #faf8f5; color: #1c1a17; margin: 0; padding: 0; }
  main { max-width: 42rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
  h1 { font-size: 2rem; margin-bottom: 2rem; }
  h2 { font-size: 1.4rem; margin-top: 2.5rem; }
  p { line-height: 1.8; font-size: 1.05rem; }
  .placeholder { border: 2px dashed #e8e0d4; border-radius: 12px; padding: 3rem 1rem; text-align: center; color: #6b6560; margin: 1.5rem 0; }
  figcaption { color: #6b6560; font-size: 0.9rem; text-align: center; margin-top: 0.5rem; }
  .intro, .conclusion { font-style: italic; color: #6b6560; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
${body}
</main>
</body>
</html>`;
}
