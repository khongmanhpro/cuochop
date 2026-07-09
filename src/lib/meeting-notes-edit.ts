import type { VietnameseMeetingNotes } from "./gemini";
import { formatMeetingNotesMarkdown } from "./formatMeetingNotesMarkdown";

export type MeetingNotesEditableFields = {
  mainTopic: string;
  executiveSummary: string[];
  decisions: string[];
  risksAndBlockers: string[];
  openQuestions: string[];
};

/** Split textarea content into non-empty trimmed lines. */
export function linesFromTextarea(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function textareaFromLines(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

/**
 * Apply editable field updates onto parsed notes JSON.
 * Transcript and action items are left unchanged (managed elsewhere).
 */
export function applyMeetingNotesEdits(
  current: VietnameseMeetingNotes,
  edits: MeetingNotesEditableFields,
): VietnameseMeetingNotes {
  const mainTopic = edits.mainTopic.trim() || "Chưa xác định";
  const executiveSummary =
    edits.executiveSummary.length > 0
      ? edits.executiveSummary
      : ["Chưa xác định"];
  const decisions =
    edits.decisions.length > 0 ? edits.decisions : ["Chưa xác định"];
  const risksAndBlockers =
    edits.risksAndBlockers.length > 0
      ? edits.risksAndBlockers
      : ["Chưa xác định"];
  const openQuestions =
    edits.openQuestions.length > 0 ? edits.openQuestions : ["Chưa xác định"];

  return {
    ...current,
    executiveSummary,
    decisions,
    risksAndBlockers,
    openQuestions,
    meetingOverview: {
      ...current.meetingOverview,
      mainTopic,
    },
  };
}

export function buildUpdatedMeetingPayload(
  currentJson: string,
  edits: MeetingNotesEditableFields,
): { notesJson: string; markdown: string; notes: VietnameseMeetingNotes } {
  let current: VietnameseMeetingNotes;
  try {
    current = JSON.parse(currentJson) as VietnameseMeetingNotes;
  } catch {
    throw new Error("INVALID_NOTES_JSON");
  }

  if (!current || typeof current !== "object") {
    throw new Error("INVALID_NOTES_JSON");
  }

  // Ensure required nested objects exist so markdown export won't crash
  const normalized: VietnameseMeetingNotes = {
    title: current.title || "Meeting Notes",
    executiveSummary: Array.isArray(current.executiveSummary)
      ? current.executiveSummary
      : [],
    meetingOverview: {
      language: current.meetingOverview?.language || "vi",
      duration: current.meetingOverview?.duration || "Chưa xác định",
      speakerCount: current.meetingOverview?.speakerCount ?? 0,
      mainTopic: current.meetingOverview?.mainTopic || "Chưa xác định",
    },
    keyDiscussionPoints: Array.isArray(current.keyDiscussionPoints)
      ? current.keyDiscussionPoints
      : [],
    decisions: Array.isArray(current.decisions) ? current.decisions : [],
    actionItems: Array.isArray(current.actionItems) ? current.actionItems : [],
    risksAndBlockers: Array.isArray(current.risksAndBlockers)
      ? current.risksAndBlockers
      : [],
    openQuestions: Array.isArray(current.openQuestions)
      ? current.openQuestions
      : [],
    transcript: current.transcript || {
      language: "vi",
      duration: "Chưa xác định",
      speakers: [],
      segments: [],
    },
    rawText: current.rawText,
  };

  const notes = applyMeetingNotesEdits(normalized, edits);
  return {
    notes,
    notesJson: JSON.stringify(notes),
    markdown: formatMeetingNotesMarkdown(notes),
  };
}
