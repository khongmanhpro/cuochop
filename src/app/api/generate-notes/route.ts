import {
  generateVietnameseMeetingNotes,
  type VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { formatMeetingNotesMarkdown } from "@/lib/formatMeetingNotesMarkdown";
import { getGeminiModelId } from "@/lib/models";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { cleanupOldUploadsSafely } from "@/lib/upload-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const transcript = payload.transcript;
    const notesModel = normalizeString(payload.notesModel);
    const originalName = normalizeString(payload.originalName) || undefined;

    if (!notesModel) {
      throw appApiError(
        "INVALID_MODEL",
        "Model tạo notes bị thiếu hoặc không hợp lệ.",
        400,
        "Missing notesModel.",
      );
    }

    getGeminiModelId(notesModel);

    if (!isTranscript(transcript)) {
      throw appApiError(
        "INVALID_TRANSCRIPT",
        "Transcript không hợp lệ hoặc đang rỗng.",
        400,
        "Transcript is required.",
      );
    }

    if (transcript.segments.length === 0) {
      throw appApiError(
        "INVALID_TRANSCRIPT",
        "Transcript không hợp lệ hoặc đang rỗng.",
        400,
        "Transcript is empty.",
      );
    }

    const notes = await generateVietnameseMeetingNotes({
      transcript,
      modelLabel: notesModel,
      originalName,
    });

    await cleanupOldUploadsSafely({ route: "/api/generate-notes" });

    return Response.json({
      ok: true,
      notes,
      markdown: formatMeetingNotesMarkdown(notes),
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/generate-notes",
      fallbackCode: "NOTES_GENERATION_FAILED",
      fallbackMessage: "Tạo meeting notes thất bại. Vui lòng thử lại.",
    });
  }
}

function isTranscript(value: unknown): value is VietnameseMeetingTranscript {
  return (
    isRecord(value) &&
    value.language === "vi" &&
    typeof value.duration === "string" &&
    Array.isArray(value.speakers) &&
    Array.isArray(value.segments)
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
