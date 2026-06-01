import { createHmac, timingSafeEqual } from "crypto";
import { logAudit } from "@/lib/audit";
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
  const organizationId = customData?.organizationId as string | undefined;
  const tier = customData?.tier === "business" ? "business" : "pro";

  if (!userId && !organizationId) {
    return new Response("OK", { status: 200 });
  }

  try {
    if (eventName === "order_created") {
      const attrs = getAttributes(event);
      const lsCustomerId = String(attrs?.customer_id ?? "");
      const lsSubscriptionId = String(attrs?.subscription_id ?? attrs?.id ?? "");

      if (organizationId) {
        const before = await prisma.organization.findUnique({ where: { id: organizationId } });
        const organization = await prisma.organization.update({
          where: { id: organizationId },
          data: {
            plan: "business",
            planExpiresAt: null,
            lsCustomerId: lsCustomerId || undefined,
            lsSubscriptionId: lsSubscriptionId || undefined,
          },
        });
        await logPlanAuditForOrganization(organizationId, before, organization);
      } else if (userId) {
        const before = await prisma.user.findUnique({ where: { id: userId } });
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            plan: tier,
            planExpiresAt: null,
            lsCustomerId: lsCustomerId || undefined,
            lsSubscriptionId: lsSubscriptionId || undefined,
          },
        });
        await logPlanAuditForUser(userId, before, user);
      }
    } else if (eventName === "subscription_cancelled") {
      const attrs = getAttributes(event);
      const endsAt = attrs?.ends_at ? new Date(String(attrs.ends_at)) : null;

      if (organizationId) {
        const before = await prisma.organization.findUnique({ where: { id: organizationId } });
        const organization = await prisma.organization.update({
          where: { id: organizationId },
          data: { planExpiresAt: endsAt },
        });
        await logPlanAuditForOrganization(organizationId, before, organization);
      } else if (userId) {
        const before = await prisma.user.findUnique({ where: { id: userId } });
        const user = await prisma.user.update({
          where: { id: userId },
          data: { planExpiresAt: endsAt },
        });
        await logPlanAuditForUser(userId, before, user);
      }
    } else if (eventName === "subscription_expired") {
      if (organizationId) {
        const before = await prisma.organization.findUnique({ where: { id: organizationId } });
        const organization = await prisma.organization.update({
          where: { id: organizationId },
          data: { plan: "free", planExpiresAt: null },
        });
        await logPlanAuditForOrganization(organizationId, before, organization);
      } else if (userId) {
        const before = await prisma.user.findUnique({ where: { id: userId } });
        const user = await prisma.user.update({
          where: { id: userId },
          data: { plan: "free", planExpiresAt: null },
        });
        await logPlanAuditForUser(userId, before, user);
      }
    }
  } catch (error) {
    console.error("[webhook] Failed to process event", eventName, error);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

async function logPlanAuditForOrganization(
  organizationId: string,
  before: { plan: string; planExpiresAt: Date | null } | null,
  after: { plan: string; planExpiresAt: Date | null },
) {
  const actor = await prisma.membership.findFirst({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!actor) return;

  await logAudit({
    organizationId,
    userId: actor.userId,
    action: "update",
    entityType: "Organization",
    entityId: organizationId,
    before: {
      plan: before?.plan ?? null,
      planExpiresAt: before?.planExpiresAt ?? null,
    },
    after: {
      plan: after.plan,
      planExpiresAt: after.planExpiresAt,
    },
  });
}

async function logPlanAuditForUser(
  userId: string,
  before: { plan: string; planExpiresAt: Date | null } | null,
  after: { plan: string; planExpiresAt: Date | null },
) {
  await logAudit({
    userId,
    action: "update",
    entityType: "User",
    entityId: userId,
    before: {
      plan: before?.plan ?? null,
      planExpiresAt: before?.planExpiresAt ?? null,
    },
    after: {
      plan: after.plan,
      planExpiresAt: after.planExpiresAt,
    },
  });
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
