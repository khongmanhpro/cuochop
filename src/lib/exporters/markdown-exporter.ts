import { formatMeetingNotesMarkdown } from "../formatMeetingNotesMarkdown";
import type { VietnameseMeetingNotes } from "../gemini";
import type { ExportOptions, ExportResult } from "./types";

export function exportMeetingNotesMarkdown(
  notes: VietnameseMeetingNotes,
  options: ExportOptions = {},
): ExportResult {
  return {
    filename: `meeting-notes-${formatExportTimestamp(options.now ?? new Date())}.md`,
    mimeType: "text/markdown; charset=utf-8",
    content: formatMeetingNotesMarkdown(notes),
    format: "markdown",
  };
}

export function formatExportTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}${month}${day}-${hours}${minutes}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
