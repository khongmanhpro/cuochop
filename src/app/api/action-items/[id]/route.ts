import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { normalizeActionItemUpdate } from "@/lib/action-items";
import { prisma } from "@/lib/db";
import { canViewHistory } from "@/lib/plans";
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

    if (!canViewHistory(user)) {
      throw appApiError(
        "PLAN_FEATURE_UNAVAILABLE",
        "Action Board chỉ có trên plan Pro. Nâng cấp để theo dõi action items.",
        403,
      );
    }

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

    const result = await prisma.actionItem.updateMany({
      where: { id, userId: user.id },
      data,
    });

    if (result.count === 0) {
      throw appApiError(
        "ACTION_ITEM_NOT_FOUND",
        "Không tìm thấy action item.",
        404,
      );
    }

    const actionItem = await prisma.actionItem.findUnique({
      where: { id },
    });

    return Response.json({
      ok: true,
      actionItem,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/action-items/[id]",
      fallbackCode: "INVALID_ACTION_ITEM_UPDATE",
      fallbackMessage: "Không thể cập nhật action item. Vui lòng thử lại.",
    });
  }
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
