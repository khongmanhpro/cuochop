import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getSession } from "@/lib/session";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import {
  getCheckoutCustomData,
  getCheckoutVariantId,
  normalizeCheckoutTier,
} from "@/lib/billing";
import { getUserOrganization } from "@/lib/organizations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const body: unknown = await request.json().catch(() => ({}));
    const payload = isRecord(body) ? body : {};
    const tier = normalizeCheckoutTier(payload.tier);
    const organizationId =
      typeof payload.organizationId === "string" ? payload.organizationId : null;

    if (organizationId) {
      const activeOrganization = await getUserOrganization(user.id);
      if (activeOrganization?.id !== organizationId) {
        throw appApiError(
          "FORBIDDEN",
          "Bạn không có quyền nâng cấp workspace này.",
          403,
        );
      }
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      throw appApiError("INTERNAL_ERROR", "Billing chưa được cấu hình.", 500);
    }

    let variantId: string;
    try {
      variantId = getCheckoutVariantId(tier, {
        LEMONSQUEEZY_VARIANT_ID: process.env.LEMONSQUEEZY_VARIANT_ID,
        LEMONSQUEEZY_BUSINESS_VARIANT_ID:
          process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID,
      });
    } catch {
      throw appApiError("INTERNAL_ERROR", "Billing chưa được cấu hình.", 500);
    }

    lemonSqueezySetup({ apiKey });

    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: user.email,
        name: user.name ?? undefined,
        custom: getCheckoutCustomData({
          userId: user.id,
          tier,
          organizationId,
        }),
      },
      checkoutOptions: {
        embed: false,
        media: false,
      },
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/app?upgrade=success`,
        receiptButtonText: "Quay lại app",
      },
    });

    const checkoutUrl = checkout.data?.data.attributes.url;
    if (!checkoutUrl) {
      throw appApiError("INTERNAL_ERROR", "Không thể tạo checkout URL.", 500);
    }

    return Response.json({ ok: true, url: checkoutUrl });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/billing/checkout",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể tạo checkout. Vui lòng thử lại.",
      fallbackStatus: 500,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
