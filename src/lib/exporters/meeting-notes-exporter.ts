import { appApiError } from "../api-errors";
import type { VietnameseMeetingNotes } from "../gemini";
import { exportMeetingNotesDocx } from "./docx-exporter";
import { exportMeetingNotesMarkdown } from "./markdown-exporter";
import type { ExportFormat, ExportOptions, ExportResult } from "./types";

export type { ExportFormat, ExportOptions, ExportResult } from "./types";
export { exportMeetingNotesDocx } from "./docx-exporter";
export { exportMeetingNotesMarkdown } from "./markdown-exporter";

export function exportMeetingNotes(
  notes: VietnameseMeetingNotes,
  format: ExportFormat,
  options: ExportOptions = {},
): ExportResult | Promise<ExportResult> {
  if (format === "markdown") {
    return exportMeetingNotesMarkdown(notes, options);
  }

  if (format === "docx") {
    return exportMeetingNotesDocx(notes, options);
  }

  throw appApiError(
    "INVALID_EXPORT_FORMAT",
    "Invalid export format.",
    400,
    `Unsupported export format: ${String(format)}`,
  );
}
