import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getSession } from "@/lib/session";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      throw appApiError("INTERNAL_ERROR", "Billing chưa được cấu hình.", 500);
    }

    lemonSqueezySetup({ apiKey });

    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: user.email,
        name: user.name ?? undefined,
        custom: { userId: user.id },
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
