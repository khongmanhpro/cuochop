import {
  generateVietnameseMeetingNotes,
  type VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { formatMeetingNotesMarkdown } from "@/lib/formatMeetingNotesMarkdown";
import { getGeminiModelId } from "@/lib/models";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { cleanupOldUploadsSafely } from "@/lib/upload-server";
import { getSession } from "@/lib/session";
import { canGenerate } from "@/lib/plans";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để sử dụng tính năng này.", 401);
    }

    if (!canGenerate(user)) {
      throw appApiError(
        "PLAN_LIMIT_EXCEEDED",
        `Bạn đã dùng hết ${user.usageThisMonth} lần miễn phí tháng này. Nâng cấp Pro để tiếp tục.`,
        423,
      );
    }

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

    const markdown = formatMeetingNotesMarkdown(notes);

    // Increment usage counter
    await prisma.user.update({
      where: { id: user.id },
      data: { usageThisMonth: { increment: 1 } },
    });

    // Save to history
    await prisma.meetingNote.create({
      data: {
        userId: user.id,
        title: notes.title || originalName || "Meeting Notes",
        audioName: originalName || "unknown",
        notesJson: JSON.stringify(notes),
        markdown,
      },
    });

    await cleanupOldUploadsSafely({ route: "/api/generate-notes" });

    return Response.json({
      ok: true,
      notes,
      markdown,
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
