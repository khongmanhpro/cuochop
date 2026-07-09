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

/** Timestamp for export filenames in Asia/Ho_Chi_Minh (stable across host TZ). */
export function formatExportTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
}
