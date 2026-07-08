/**
 * Integration tests for webhook + cron routes.
 *
 * Verifies:
 * - Webhook rejects invalid signature (401)
 * - Webhook rejects missing signature (401)
 * - Webhook returns 500 when secret not configured
 * - Webhook processes order_created → upgrades user plan
 * - Webhook processes subscription_expired → downgrades to free
 * - Webhook processes subscription_cancelled → sets planExpiresAt
 * - Webhook creates audit log on plan change
 * - Cron rejects unauthorized requests (401)
 * - Cron accepts authorized requests with Bearer token
 * - Cron accepts authorized requests with x-cron-secret header
 * - Cron sends deadline reminders for due action items
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { createHmac } from "node:crypto";
import {
  clearCookies,
  createTestUser,
  getPrisma,
  seedActionItem,
  seedMeetingNote,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";

// Mock email sending for cron tests
vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail as mockedSendEmail } from "../lib/email";

const WEBHOOK_SECRET = "test-webhook-secret";
const CRON_SECRET = "test-cron-secret";

function signWebhook(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function buildWebhookEvent(
  eventName: string,
  customData: Record<string, string>,
  attributes: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    meta: {
      event_name: eventName,
      custom_data: customData,
    },
    data: {
      attributes: {
        customer_id: "cust_123",
        subscription_id: "sub_456",
        ...attributes,
      },
    },
  });
}

describe("webhook + cron — integration", () => {
  beforeAll(async () => {
    setupTestDb();
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --force-reset", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    delete process.env.CRON_SECRET;
    await teardownTestDb();
  });

  // --- Webhook tests ---

  test("webhook returns 500 when secret not configured", async () => {
    const originalSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    try {
      const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
      const response = await POST(
        new Request("http://localhost/api/webhooks/lemonsqueezy", {
          method: "POST",
          body: "{}",
        }),
      );
      expect(response.status).toBe(500);
    } finally {
      if (originalSecret) process.env.LEMONSQUEEZY_WEBHOOK_SECRET = originalSecret;
    }
  });

  test("returns 401 for missing signature", async () => {
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body: '{"test": true}',
      }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 401 for invalid signature", async () => {
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body: '{"test": true}',
        headers: { "X-Signature": "invalid-signature" },
      }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 400 for invalid JSON with valid signature", async () => {
    const body = "not json at all";
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(400);
  });

  test("returns 200 for event without userId or organizationId", async () => {
    const body = buildWebhookEvent("order_created", {});
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(200);
  });

  test("order_created upgrades user plan to pro", async () => {
    const user = await createTestUser();
    const prisma = await getPrisma();

    const body = buildWebhookEvent("order_created", { userId: user.id });
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.plan).toBe("pro");
    expect(updatedUser?.lsCustomerId).toBe("cust_123");
    expect(updatedUser?.lsSubscriptionId).toBe("sub_456");

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: user.id, entityType: "User" },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe("update");
  });

  test("order_created upgrades user plan to business when tier=business", async () => {
    const user = await createTestUser();
    const prisma = await getPrisma();

    const body = buildWebhookEvent("order_created", {
      userId: user.id,
      tier: "business",
    });
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.plan).toBe("business");
  });

  test("subscription_expired downgrades user to free", async () => {
    const user = await createTestUser();
    const prisma = await getPrisma();

    // First upgrade to pro
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "pro" },
    });

    const body = buildWebhookEvent("subscription_expired", { userId: user.id });
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.plan).toBe("free");
    expect(updatedUser?.planExpiresAt).toBeNull();
  });

  test("subscription_cancelled sets planExpiresAt", async () => {
    const user = await createTestUser();
    const prisma = await getPrisma();

    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "pro" },
    });

    const endsAt = "2025-12-31T23:59:59Z";
    const body = buildWebhookEvent(
      "subscription_cancelled",
      { userId: user.id },
      { ends_at: endsAt },
    );
    const { POST } = await import("../app/api/webhooks/lemonsqueezy/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        body,
        headers: { "X-Signature": signWebhook(body) },
      }),
    );
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.planExpiresAt).toEqual(new Date(endsAt));
  });

  // --- Cron tests ---

  beforeEach(() => {
    vi.mocked(mockedSendEmail).mockClear();
  });

  test("cron returns 401 without auth", async () => {
    const { POST } = await import("../app/api/cron/deadline-reminders/route");
    const response = await POST(
      new Request("http://localhost/api/cron/deadline-reminders", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 401 with wrong secret", async () => {
    const { POST } = await import("../app/api/cron/deadline-reminders/route");
    const response = await POST(
      new Request("http://localhost/api/cron/deadline-reminders", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });

  test("accepts Bearer token auth", async () => {
    const { POST } = await import("../app/api/cron/deadline-reminders/route");
    const response = await POST(
      new Request("http://localhost/api/cron/deadline-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test("accepts x-cron-secret header auth", async () => {
    const { POST } = await import("../app/api/cron/deadline-reminders/route");
    const response = await POST(
      new Request("http://localhost/api/cron/deadline-reminders", {
        method: "POST",
        headers: { "x-cron-secret": CRON_SECRET },
      }),
    );
    expect(response.status).toBe(200);
  });

  test("sends deadline reminders for due action items", async () => {
    const user = await createTestUser();
    const prisma = await getPrisma();

    const meetingNote = await seedMeetingNote(user.id);
    // Create action item with a deadline within 2 days (ISO format parseable)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadlineStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD
    await seedActionItem(meetingNote.id, user.id, {
      task: "Urgent task due tomorrow",
      deadline: deadlineStr,
      status: "todo",
    });

    const { POST } = await import("../app/api/cron/deadline-reminders/route");
    const response = await POST(
      new Request("http://localhost/api/cron/deadline-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.emailsSent).toBeGreaterThanOrEqual(1);

    // Verify email was sent
    expect(vi.mocked(mockedSendEmail)).toHaveBeenCalled();

    // Verify notification created
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, type: "deadline_reminder" },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // Verify lastReminderSent updated
    const actionItems = await prisma.actionItem.findMany({
      where: { userId: user.id },
    });
    expect(actionItems[0]?.lastReminderSent).toBeTruthy();
  });
});
