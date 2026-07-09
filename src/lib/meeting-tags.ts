import type { VietnameseMeetingNotes } from "./gemini";

export type NotesWithTags = VietnameseMeetingNotes & { tags?: string[] };

export function parseTagsInput(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 12);
}

export function tagsFromNotesJson(notesJson: string): string[] {
  try {
    const parsed = JSON.parse(notesJson) as NotesWithTags;
    if (!Array.isArray(parsed.tags)) return [];
    return parsed.tags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function applyTagsToNotesJson(
  notesJson: string,
  tags: string[],
): string {
  let parsed: NotesWithTags;
  try {
    parsed = JSON.parse(notesJson) as NotesWithTags;
  } catch {
    throw new Error("INVALID_NOTES_JSON");
  }
  parsed.tags = tags;
  return JSON.stringify(parsed);
}

export function notesMatchTag(notesJson: string, tag: string): boolean {
  if (!tag.trim()) return true;
  const needle = tag.trim().toLowerCase();
  return tagsFromNotesJson(notesJson).includes(needle);
}
