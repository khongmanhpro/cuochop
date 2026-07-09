import { buildDecisionCreatePayloads } from "@/lib/action-items";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  generateVietnameseMeetingNotes,
  type VietnameseMeetingNotes,
  type VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { formatMeetingNotesMarkdown } from "@/lib/formatMeetingNotesMarkdown";
import { assertAccessibleMeetingNote } from "@/lib/meeting-access";
import { getMeetingTemplate } from "@/lib/meeting-templates";
import { getGeminiModelId } from "@/lib/models";
import { getUserOrganization } from "@/lib/organizations";
import { checkGeminiRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { tagsFromNotesJson } from "@/lib/meeting-tags";

export const runtime = "nodejs";

/**
 * D1: Re-generate notes from transcript already stored in notesJson.
 * Does NOT re-upload audio. Keeps existing ActionItems; replaces Decision rows.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/meetings/[id]/regenerate">,
) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const rateLimit = checkGeminiRateLimit(user.id);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterMs);
    }

    const { id: meetingId } = await ctx.params;
    if (!meetingId) {
      throw appApiError("INVALID_NOTES_DATA", "Thiếu mã cuộc họp.", 400);
    }

    const existing = await assertAccessibleMeetingNote(user.id, meetingId);
    if (!existing) {
      throw appApiError(
        "INVALID_NOTES_DATA",
        "Không tìm thấy cuộc họp hoặc bạn không có quyền.",
        404,
      );
    }

    const body: unknown = await request.json().catch(() => ({}));
    const payload = isRecord(body) ? body : {};
    const notesModel =
      (typeof payload.notesModel === "string" && payload.notesModel) ||
      "Gemini 3 Flash Preview";
    const templateId =
      (typeof payload.template === "string" && payload.template) || "default";

    getGeminiModelId(notesModel);
    const template = getMeetingTemplate(templateId);

    const previous = parseNotes(existing.notesJson);
    const transcript = previous.transcript;
    if (!transcript?.segments?.length) {
      throw appApiError(
        "INVALID_TRANSCRIPT",
        "Cuộc họp này không có transcript để tạo lại notes.",
        400,
      );
    }

    const preservedTags = tagsFromNotesJson(existing.notesJson);

    const notes = await generateVietnameseMeetingNotes({
      transcript: transcript as VietnameseMeetingTranscript,
      modelLabel: notesModel,
      originalName: existing.audioName,
      templateSuffix: template.promptSuffix,
    });

    // Keep speaker renames already applied in stored transcript
    notes.transcript = transcript as VietnameseMeetingTranscript;
    if (preservedTags.length > 0) {
      (notes as VietnameseMeetingNotes & { tags?: string[] }).tags =
        preservedTags;
    }

    const markdown = formatMeetingNotesMarkdown(notes);
    const activeOrganization = await getUserOrganization(user.id);

    await prisma.$transaction(async (tx) => {
      await tx.meetingNote.update({
        where: { id: meetingId },
        data: {
          title: notes.title || existing.title,
          notesJson: JSON.stringify(notes),
          markdown,
        },
      });

      await tx.decision.deleteMany({ where: { meetingNoteId: meetingId } });
      const decisions = buildDecisionCreatePayloads({
        notes,
        meetingNoteId: meetingId,
        userId: existing.userId,
        organizationId: existing.organizationId,
      });
      if (decisions.length > 0) {
        await tx.decision.createMany({ data: decisions });
      }
    });

    await logAudit({
      organizationId: activeOrganization?.id ?? existing.organizationId,
      userId: user.id,
      action: "update",
      entityType: "MeetingNote",
      entityId: meetingId,
      after: { regenerated: true, notesModel },
      ipAddress: getRequestIp(request),
    });

    return Response.json({
      ok: true,
      meetingNoteId: meetingId,
      title: notes.title || existing.title,
      notes,
      markdown,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/meetings/[id]/regenerate",
      fallbackCode: "NOTES_GENERATION_FAILED",
      fallbackMessage: "Tạo lại notes thất bại. Vui lòng thử lại.",
    });
  }
}

function parseNotes(notesJson: string): VietnameseMeetingNotes {
  try {
    return JSON.parse(notesJson) as VietnameseMeetingNotes;
  } catch {
    throw appApiError(
      "INVALID_NOTES_DATA",
      "Không đọc được notes hiện tại.",
      400,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
