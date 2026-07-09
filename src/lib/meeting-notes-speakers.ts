import type { VietnameseMeetingNotes } from "./gemini";
import { formatMeetingNotesMarkdown } from "./formatMeetingNotesMarkdown";

export type SpeakerRenameMap = Record<string, string>;

/**
 * Rename speakers in notes transcript (segments + speakers list).
 * Keys are old speaker labels (e.g. "Speaker 1"), values are new display names.
 */
export function applySpeakerRenames(
  notes: VietnameseMeetingNotes,
  renames: SpeakerRenameMap,
): VietnameseMeetingNotes {
  const map = normalizeRenameMap(renames);
  if (Object.keys(map).length === 0) return notes;

  const rename = (label: string) => {
    const key = label.trim();
    return map[key] || map[key.toLowerCase()] || label;
  };

  const speakers = Array.from(
    new Set((notes.transcript?.speakers ?? []).map(rename).filter(Boolean)),
  );

  const segments = (notes.transcript?.segments ?? []).map((segment) => ({
    ...segment,
    speaker: rename(segment.speaker),
  }));

  return {
    ...notes,
    transcript: {
      ...notes.transcript,
      language: notes.transcript?.language || "vi",
      duration: notes.transcript?.duration || "Chưa xác định",
      speakers,
      segments,
    },
  };
}

export function buildSpeakerRenamePayload(
  notesJson: string,
  renames: SpeakerRenameMap,
): { notesJson: string; markdown: string; notes: VietnameseMeetingNotes } {
  const notes = parseNotes(notesJson);
  const next = applySpeakerRenames(notes, renames);
  return {
    notes: next,
    notesJson: JSON.stringify(next),
    markdown: formatMeetingNotesMarkdown(next),
  };
}

export function listSpeakers(notes: VietnameseMeetingNotes): string[] {
  const fromList = notes.transcript?.speakers ?? [];
  const fromSegments = (notes.transcript?.segments ?? []).map((s) => s.speaker);
  return Array.from(new Set([...fromList, ...fromSegments].map((s) => s.trim()).filter(Boolean)));
}

function normalizeRenameMap(renames: SpeakerRenameMap): SpeakerRenameMap {
  const map: SpeakerRenameMap = {};
  for (const [from, to] of Object.entries(renames)) {
    const key = from.trim();
    const value = to.trim();
    if (!key || !value || key === value) continue;
    map[key] = value;
    map[key.toLowerCase()] = value;
  }
  return map;
}

function parseNotes(notesJson: string): VietnameseMeetingNotes {
  try {
    return JSON.parse(notesJson) as VietnameseMeetingNotes;
  } catch {
    throw new Error("INVALID_NOTES_JSON");
  }
}
