/**
 * Integration test for /api/notifications route.
 *
 * Verifies the test harness works end-to-end:
 * - Real Prisma queries against temp SQLite
 * - Mocked next/headers cookies for auth
 * - getSession() resolves to the test user
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  clearCookies,
  createTestUser,
  getPrisma,
  setAuthCookie,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";

describe("/api/notifications — integration", () => {
  beforeAll(async () => {
    setupTestDb();
    // Push schema to temp DB (Prisma 7: no --skip-generate flag)
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --force-reset", {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(() => {
    clearCookies();
  });

  test("GET returns 401 without auth", async () => {
    const { GET } = await import("../app/api/notifications/route");
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("GET returns empty notifications for new user", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { GET } = await import("../app/api/notifications/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.unreadCount).toBe(0);
    expect(body.notifications).toEqual([]);
  });

  test("GET returns notifications with unread count", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    // Create notifications with explicit timestamps to ensure deterministic order
    const baseTime = new Date("2024-01-15T10:00:00Z");
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "deadline_reminder",
        title: "Action item due",
        body: "Task A is due tomorrow",
        read: false,
        createdAt: baseTime,
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "weekly_digest",
        title: "Weekly digest",
        body: "Your weekly summary",
        read: true,
        createdAt: new Date("2024-01-15T11:00:00Z"),
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "deadline_reminder",
        title: "Action item due",
        body: "Task B is due today",
        read: false,
        createdAt: new Date("2024-01-15T12:00:00Z"),
      },
    });

    const { GET } = await import("../app/api/notifications/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.unreadCount).toBe(2);
    expect(body.notifications).toHaveLength(3);
    // Ordered by createdAt desc — newest first
    expect(body.notifications[0].body).toBe("Task B is due today");
    expect(body.notifications[2].body).toBe("Task A is due tomorrow");
  });

  test("PATCH marks all unread notifications as read", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: "deadline_reminder",
          title: "A",
          body: "Body A",
          read: false,
        },
        {
          userId: user.id,
          type: "deadline_reminder",
          title: "B",
          body: "Body B",
          read: false,
        },
      ],
    });

    const { PATCH } = await import("../app/api/notifications/route");
    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(200);

    const unread = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });
    expect(unread).toBe(0);
  });

  test("PATCH marks single notification as read by id", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: "deadline_reminder",
        title: "Single",
        body: "Body single",
        read: false,
      },
    });

    const { PATCH } = await import("../app/api/notifications/route");
    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      }),
    );
    expect(response.status).toBe(200);

    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated?.read).toBe(true);
  });

  test("GET does not leak notifications from other users", async () => {
    const user1 = await createTestUser({ email: "user1@test.com" });
    const user2 = await createTestUser({ email: "user2@test.com" });
    const prisma = await getPrisma();

    await prisma.notification.create({
      data: {
        userId: user1.id,
        type: "deadline_reminder",
        title: "User1 private",
        body: "Private to user1",
        read: false,
      },
    });

    await setAuthCookie(user2.id);
    const { GET } = await import("../app/api/notifications/route");
    const response = await GET();
    const body = await response.json();
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });
});
