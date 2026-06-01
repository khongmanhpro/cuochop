import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
    ]);

    return Response.json({
      ok: true,
      unreadCount,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        read: notification.read,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/notifications",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể tải notifications.",
      fallbackStatus: 500,
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const body: unknown = await request.json().catch(() => ({}));
    const payload = isRecord(body) ? body : {};
    const id = typeof payload.id === "string" ? payload.id : null;

    if (id) {
      await prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/notifications",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể cập nhật notifications.",
      fallbackStatus: 500,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
