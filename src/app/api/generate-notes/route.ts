import {
  generateVietnameseMeetingNotes,
  type VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { formatMeetingNotesMarkdown } from "@/lib/formatMeetingNotesMarkdown";
import { getGeminiModelId } from "@/lib/models";
import { getMeetingTemplate } from "@/lib/meeting-templates";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { cleanupOldUploadsSafely } from "@/lib/upload-server";
import { getSession } from "@/lib/session";
import { getRequestIp, logAudit } from "@/lib/audit";
import { getUserOrganization } from "@/lib/organizations";
import { logError, logWarn } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  buildActionItemCreatePayloads,
  buildDecisionCreatePayloads,
} from "@/lib/action-items";
import { detectConflicts, persistConflicts } from "@/lib/contradiction-detector";
import {
  buildFollowUpBriefBlocks,
  postSlackMessage,
} from "@/lib/slack";
import { checkGeminiRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để sử dụng tính năng này.", 401);
    }

    const rateLimit = checkGeminiRateLimit(user.id);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterMs);
    }

    const activeOrganization = await getUserOrganization(user.id);

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const transcript = payload.transcript;
    const notesModel = normalizeString(payload.notesModel);
    const originalName = normalizeString(payload.originalName) || undefined;
    const templateId = normalizeString(payload.template) || "default";
    const template = getMeetingTemplate(templateId);

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
      templateSuffix: template.promptSuffix,
    });

    const markdown = formatMeetingNotesMarkdown(notes);

    // Increment usage counter
    await prisma.user.update({
      where: { id: user.id },
      data: { usageThisMonth: { increment: 1 } },
    });

    // Save to history (actions are persisted immediately after this — clients may triage)
    const meetingNote = await prisma.meetingNote.create({
      data: {
        userId: user.id,
        organizationId: activeOrganization?.id,
        title: notes.title || originalName || "Meeting Notes",
        audioName: originalName || "unknown",
        notesJson: JSON.stringify(notes),
        markdown,
      },
    });
    const ipAddress = getRequestIp(request);
    const createdActionItems: Array<{
      id: string;
      task: string;
      deadline: string;
      priority: string;
      ownerId: string | null;
      status: string;
    }> = [];

    await logAudit({
      organizationId: activeOrganization?.id,
      userId: user.id,
      action: "create",
      entityType: "MeetingNote",
      entityId: meetingNote.id,
      after: {
        id: meetingNote.id,
        title: meetingNote.title,
        audioName: meetingNote.audioName,
      },
      ipAddress,
    });

    try {
      const orgMembers = activeOrganization
        ? await prisma.membership.findMany({
            where: { organizationId: activeOrganization.id },
            select: { user: { select: { id: true, name: true, email: true } } },
          }).then((memberships) =>
            memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
          )
        : undefined;

      const actionItems = buildActionItemCreatePayloads({
        notes,
        meetingNoteId: meetingNote.id,
        userId: user.id,
        organizationId: activeOrganization?.id,
        orgMembers,
      });
      const decisions = buildDecisionCreatePayloads({
        notes,
        meetingNoteId: meetingNote.id,
        userId: user.id,
        organizationId: activeOrganization?.id,
      });

      if (actionItems.length > 0) {
        for (const payload of actionItems) {
          const actionItem = await prisma.actionItem.create({ data: payload });
          createdActionItems.push({
            id: actionItem.id,
            task: actionItem.task,
            deadline: actionItem.deadline,
            priority: actionItem.priority,
            ownerId: actionItem.ownerId,
            status: actionItem.status,
          });
          await logAudit({
            organizationId: actionItem.organizationId,
            userId: user.id,
            action: "create",
            entityType: "ActionItem",
            entityId: actionItem.id,
            after: {
              id: actionItem.id,
              task: actionItem.task,
              ownerId: actionItem.ownerId,
              deadline: actionItem.deadline,
              priority: actionItem.priority,
              status: actionItem.status,
            },
            ipAddress,
          });
        }
      }

      if (decisions.length > 0) {
        for (const payload of decisions) {
          const decision = await prisma.decision.create({ data: payload });
          await logAudit({
            organizationId: decision.organizationId,
            userId: user.id,
            action: "create",
            entityType: "Decision",
            entityId: decision.id,
            after: {
              id: decision.id,
              content: decision.content,
            },
            ipAddress,
          });
        }

        // Detect potential conflicts with existing decisions
        const createdDecisions = await prisma.decision.findMany({
          where: { meetingNoteId: meetingNote.id },
          select: { id: true, content: true },
        });
        for (const decision of createdDecisions) {
          try {
            const conflicts = await detectConflicts(
              decision.id,
              decision.content,
              activeOrganization?.id,
              user.id,
            );
            await persistConflicts(decision.id, conflicts);
          } catch (conflictErr) {
            logWarn({
              route: "/api/generate-notes",
              userId: user.id,
              code: "CONFLICT_DETECTOR_FAILED",
              message:
                conflictErr instanceof Error
                  ? conflictErr.message
                  : "conflict detector failed",
              decisionId: decision.id,
            });
          }
        }
      }
    } catch (error) {
      logWarn({
        route: "/api/generate-notes",
        userId: user.id,
        code: "ACTION_TRACKER_FAILED",
        message:
          error instanceof Error ? error.message : "action tracker failed",
      });
    }

    if (activeOrganization) {
      try {
        const slackSettings = await prisma.organization.findUnique({
          where: { id: activeOrganization.id },
          select: {
            slackAutoPostEnabled: true,
            slackIntegration: true,
          },
        });
        const integration = slackSettings?.slackIntegration;

        if (
          slackSettings?.slackAutoPostEnabled &&
          integration?.accessToken &&
          integration.channelId
        ) {
          const appUrl =
            process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
          const meetingUrl = `${appUrl}/history?meeting=${meetingNote.id}&highlight=${meetingNote.id}&section=note`;

          await postSlackMessage({
            encryptedAccessToken: integration.accessToken,
            channelId: integration.channelId,
            text: `Follow-up sau cuộc họp: ${notes.title || "Meeting Notes"}`,
            blocks: buildFollowUpBriefBlocks(notes, meetingUrl),
          });
        }
      } catch (slackError) {
        logWarn({
          route: "/api/generate-notes",
          userId: user.id,
          code: "SLACK_POST_FAILED",
          message:
            slackError instanceof Error
              ? slackError.message
              : "slack post failed",
        });
      }
    }

    await cleanupOldUploadsSafely({ route: "/api/generate-notes" });

    return Response.json({
      ok: true,
      notes,
      markdown,
      meetingNoteId: meetingNote.id,
      // Post-save triage: actions already in DB; client may discard via DELETE
      actionItems: createdActionItems,
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
