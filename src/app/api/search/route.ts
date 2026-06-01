import { getSession } from "@/lib/session";
import { getUserOrganization } from "@/lib/organizations";
import { searchContent } from "@/lib/search";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return Response.json({ ok: true, results: [] });
    }

    const activeOrganization = await getUserOrganization(user.id);

    const results = await searchContent(
      query,
      user.id,
      activeOrganization?.id,
    );

    return Response.json({ ok: true, results });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/search",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể tìm kiếm.",
    });
  }
}
