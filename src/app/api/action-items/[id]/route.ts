import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { normalizeActionItemUpdate } from "@/lib/action-items";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  buttonLink,
  escapeHtml,
  renderEmailLayout,
} from "@/lib/email-templates/base";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/action-items/[id]">,
) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError(
        "UNAUTHENTICATED",
        "Bạn cần đăng nhập để cập nhật action item.",
        401,
      );
    }

    const activeOrganization = await getUserOrganization(user.id);

    const { id } = await ctx.params;
    if (!id) {
      throw appApiError(
        "ACTION_ITEM_NOT_FOUND",
        "Không tìm thấy action item.",
        404,
      );
    }

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const data = normalizeUpdatePayload(payload);

    const existingActionItem = await prisma.actionItem.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        ownerId: true,
        task: true,
        deadline: true,
        priority: true,
        status: true,
        notes: true,
      },
    });

    if (!existingActionItem || !canUpdateActionItem({
      userId: user.id,
      organizationId: activeOrganization?.id ?? null,
      actionItemUserId: existingActionItem.userId,
      actionItemOrganizationId: existingActionItem.organizationId,
    })) {
      throw appApiError(
        "ACTION_ITEM_NOT_FOUND",
        "Không tìm thấy action item.",
        404,
      );
    }

    if (data.ownerId) {
      await assertAssignableOwner({
        ownerId: data.ownerId,
        organizationId: existingActionItem.organizationId,
        creatorUserId: existingActionItem.userId,
      });
    }

    const actionItem = await prisma.actionItem.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await logAudit({
      organizationId: actionItem.organizationId,
      userId: user.id,
      action: "update",
      entityType: "ActionItem",
      entityId: actionItem.id,
      before: {
        ownerId: existingActionItem.ownerId,
        task: existingActionItem.task,
        deadline: existingActionItem.deadline,
        priority: existingActionItem.priority,
        status: existingActionItem.status,
        notes: existingActionItem.notes,
      },
      after: {
        ownerId: actionItem.ownerId,
        task: actionItem.task,
        deadline: actionItem.deadline,
        priority: actionItem.priority,
        status: actionItem.status,
        notes: actionItem.notes,
      },
      ipAddress: getRequestIp(request),
    });

    if (data.ownerId && data.ownerId !== existingActionItem.ownerId) {
      await notifyAssignedOwner({
        ownerId: data.ownerId,
        task: actionItem.task,
        actionUrl: `/actions?filter=assigned&item=${actionItem.id}`,
      });
    }

    return Response.json({
      ok: true,
      actionItem: {
        ...actionItem,
        ownerName: actionItem.owner
          ? actionItem.owner.name || actionItem.owner.email
          : "Unassigned",
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/action-items/[id]",
      fallbackCode: "INVALID_ACTION_ITEM_UPDATE",
      fallbackMessage: "Không thể cập nhật action item. Vui lòng thử lại.",
    });
  }
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

async function notifyAssignedOwner({
  ownerId,
  task,
  actionUrl,
}: {
  ownerId: string;
  task: string;
  actionUrl: string;
}) {
  const assignee = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true, name: true },
  });
  if (!assignee) return;

  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: "task_assigned",
      title: "Bạn vừa được assign một action item",
      body: task,
      actionUrl,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const html = renderEmailLayout({
    title: "New action item assigned",
    preview: task,
    body: `
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
        ${escapeHtml(task)}
      </p>
      ${buttonLink("Open Action Board", `${appUrl}${actionUrl}`)}
    `,
  });

  try {
    await sendEmail(
      assignee.email,
      "New action item assigned",
      html,
      `New action item assigned\n${task}\n${appUrl}${actionUrl}`,
    );
  } catch (error) {
    console.warn("[action-items] failed to send assignment email", error);
  }
}

function canUpdateActionItem({
  userId,
  organizationId,
  actionItemUserId,
  actionItemOrganizationId,
}: {
  userId: string;
  organizationId: string | null;
  actionItemUserId: string;
  actionItemOrganizationId: string | null;
}) {
  if (actionItemUserId === userId) return true;
  return Boolean(
    actionItemOrganizationId && organizationId === actionItemOrganizationId,
  );
}

function normalizeUpdatePayload(payload: Record<string, unknown>) {
  try {
    return normalizeActionItemUpdate(payload);
  } catch (error) {
    throw appApiError(
      "INVALID_ACTION_ITEM_UPDATE",
      "Dữ liệu cập nhật action item không hợp lệ.",
      400,
      error instanceof Error ? error.message : undefined,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
