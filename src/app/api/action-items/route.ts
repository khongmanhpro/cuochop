import {
  normalizeActionItemCreate,
  type ActionItemPriority,
} from "@/lib/action-items";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MANUAL_MEETING_TITLE = "Việc thủ công";
const MANUAL_AUDIO_NAME = "manual";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError(
        "UNAUTHENTICATED",
        "Bạn cần đăng nhập để tạo action item.",
        401,
      );
    }

    const activeOrganization = await getUserOrganization(user.id);
    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};

    let data: ReturnType<typeof normalizeActionItemCreate>;
    try {
      data = normalizeActionItemCreate(payload);
    } catch (error) {
      throw appApiError(
        "INVALID_ACTION_ITEM_UPDATE",
        "Dữ liệu action item không hợp lệ.",
        400,
        error instanceof Error ? error.message : undefined,
      );
    }

    const meetingNoteId = await resolveMeetingNoteId({
      userId: user.id,
      organizationId: activeOrganization?.id ?? null,
      requestedMeetingNoteId: data.meetingNoteId,
    });

    if (data.ownerId) {
      await assertAssignableOwner({
        ownerId: data.ownerId,
        organizationId: activeOrganization?.id ?? null,
        creatorUserId: user.id,
      });
    }

    const actionItem = await prisma.actionItem.create({
      data: {
        meetingNoteId,
        userId: user.id,
        organizationId: activeOrganization?.id ?? null,
        ownerId: data.ownerId,
        task: data.task,
        deadline: data.deadline,
        priority: data.priority as ActionItemPriority,
        status: data.status,
        notes: data.notes,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        meetingNote: { select: { title: true, audioName: true } },
      },
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
      ipAddress: getRequestIp(request),
    });

    return Response.json({
      ok: true,
      actionItem: {
        id: actionItem.id,
        task: actionItem.task,
        ownerId: actionItem.ownerId,
        ownerName: actionItem.owner
          ? actionItem.owner.name || actionItem.owner.email
          : "Chưa gán",
        deadline: actionItem.deadline,
        priority: actionItem.priority,
        status: actionItem.status,
        notes: actionItem.notes,
        createdAt: actionItem.createdAt.toISOString(),
        meetingTitle: actionItem.meetingNote.title,
        audioName: actionItem.meetingNote.audioName,
        createdBy: user.name || user.email,
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/action-items",
      fallbackCode: "INVALID_ACTION_ITEM_UPDATE",
      fallbackMessage: "Không thể tạo action item. Vui lòng thử lại.",
    });
  }
}

async function resolveMeetingNoteId({
  userId,
  organizationId,
  requestedMeetingNoteId,
}: {
  userId: string;
  organizationId: string | null;
  requestedMeetingNoteId: string | null;
}) {
  if (requestedMeetingNoteId) {
    const meeting = await prisma.meetingNote.findFirst({
      where: organizationId
        ? { id: requestedMeetingNoteId, organizationId }
        : { id: requestedMeetingNoteId, userId },
      select: { id: true },
    });
    if (!meeting) {
      throw appApiError(
        "INVALID_ACTION_ITEM_UPDATE",
        "Cuộc họp gắn action không hợp lệ.",
        400,
      );
    }
    return meeting.id;
  }

  const existing = await prisma.meetingNote.findFirst({
    where: organizationId
      ? {
          organizationId,
          title: MANUAL_MEETING_TITLE,
          audioName: MANUAL_AUDIO_NAME,
        }
      : {
          userId,
          title: MANUAL_MEETING_TITLE,
          audioName: MANUAL_AUDIO_NAME,
        },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.meetingNote.create({
    data: {
      userId,
      organizationId,
      title: MANUAL_MEETING_TITLE,
      audioName: MANUAL_AUDIO_NAME,
      notesJson: JSON.stringify({
        title: MANUAL_MEETING_TITLE,
        executiveSummary: ["Các việc tạo thủ công ngoài cuộc họp."],
        meetingOverview: {
          language: "vi",
          duration: "Chưa xác định",
          speakerCount: 0,
          mainTopic: MANUAL_MEETING_TITLE,
        },
        keyDiscussionPoints: [],
        decisions: [],
        actionItems: [],
        risksAndBlockers: [],
        openQuestions: [],
        transcript: {
          language: "vi",
          duration: "Chưa xác định",
          speakers: [],
          segments: [],
        },
      }),
      markdown: `# ${MANUAL_MEETING_TITLE}\n\nCác việc tạo thủ công.\n`,
    },
    select: { id: true },
  });

  return created.id;
}

async function assertAssignableOwner({
  ownerId,
  organizationId,
  creatorUserId,
}: {
  ownerId: string;
  organizationId: string | null;
  creatorUserId: string;
}) {
  if (!organizationId) {
    if (ownerId !== creatorUserId) {
      throw appApiError(
        "INVALID_ACTION_ITEM_UPDATE",
        "Owner không hợp lệ.",
        400,
      );
    }
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: ownerId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw appApiError(
      "INVALID_ACTION_ITEM_UPDATE",
      "Owner phải là member của workspace.",
      400,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
