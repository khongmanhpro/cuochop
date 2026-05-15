import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventName = event.meta && typeof event.meta === "object"
    ? (event.meta as Record<string, unknown>).event_name as string
    : null;

  const customData = event.meta && typeof event.meta === "object"
    ? (event.meta as Record<string, unknown>).custom_data as Record<string, unknown> | undefined
    : undefined;

  const userId = customData?.userId as string | undefined;

  if (!userId) {
    return new Response("OK", { status: 200 });
  }

  try {
    if (eventName === "order_created") {
      const attrs = getAttributes(event);
      const lsCustomerId = String(attrs?.customer_id ?? "");
      const lsSubscriptionId = String(attrs?.subscription_id ?? attrs?.id ?? "");

      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "pro",
          planExpiresAt: null,
          lsCustomerId: lsCustomerId || undefined,
          lsSubscriptionId: lsSubscriptionId || undefined,
        },
      });
    } else if (eventName === "subscription_cancelled") {
      const attrs = getAttributes(event);
      const endsAt = attrs?.ends_at ? new Date(String(attrs.ends_at)) : null;

      await prisma.user.update({
        where: { id: userId },
        data: { planExpiresAt: endsAt },
      });
    } else if (eventName === "subscription_expired") {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: "free", planExpiresAt: null },
      });
    }
  } catch (error) {
    console.error("[webhook] Failed to process event", eventName, error);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function getAttributes(event: Record<string, unknown>) {
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const attrs = (data as Record<string, unknown>).attributes;
  return attrs && typeof attrs === "object"
    ? (attrs as Record<string, unknown>)
    : null;
}
