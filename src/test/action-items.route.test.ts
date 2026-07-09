/**
 * Integration tests for /api/action-items/[id] PATCH route.
 *
 * Verifies:
 * - Auth required (401 without session)
 * - 404 for non-existent action item
 * - 404 for action item owned by another user (no org)
 * - 200 for valid update (status, priority, deadline, notes)
 * - Audit log entry created on update
 * - Notification + email sent when ownerId changes
 * - 400 for invalid owner (non-member of org)
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
import {
  clearCookies,
  createTestUser,
  getPrisma,
  seedActionItem,
  seedMeetingNote,
  setAuthCookie,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";

// Mock email sending
vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Import the mocked module for assertion
import { sendEmail as mockedSendEmail } from "../lib/email";

describe("/api/action-items/[id] PATCH — integration", () => {
  beforeAll(async () => {
    setupTestDb();
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --force-reset", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(() => {
    clearCookies();
    vi.mocked(mockedSendEmail).mockClear();
  });

  test("returns 401 without auth", async () => {
    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/action-items/test-id", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "test-id" }) },
    );
    expect(response.status).toBe(401);
  });

  test("returns 404 for non-existent action item", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/action-items/nonexistent", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("ACTION_ITEM_NOT_FOUND");
  });

  test("returns 404 for action item owned by another user (no org)", async () => {
    const user1 = await createTestUser({ email: "owner@test.com" });
    const user2 = await createTestUser({ email: "intruder@test.com" });
    const prisma = await getPrisma();

    const meetingNote = await seedMeetingNote(user1.id);
    const actionItem = await seedActionItem(meetingNote.id, user1.id);

    // user2 tries to update user1's action item
    await setAuthCookie(user2.id);
    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(404);
  });

  test("successfully updates status and creates audit log", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const meetingNote = await seedMeetingNote(user.id);
    const actionItem = await seedActionItem(meetingNote.id, user.id, {
      status: "todo",
    });

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.actionItem.status).toBe("done");

    // Verify DB updated
    const updated = await prisma.actionItem.findUnique({
      where: { id: actionItem.id },
    });
    expect(updated?.status).toBe("done");

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: user.id, entityType: "ActionItem" },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe("update");
  });

  test("updates priority, deadline, and notes", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const meetingNote = await seedMeetingNote(user.id);
    const actionItem = await seedActionItem(meetingNote.id, user.id, {
      priority: "Low",
      deadline: "Next week",
      notes: "Original notes",
    });

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          priority: "High",
          deadline: "Tomorrow",
          notes: "Updated notes",
        }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.actionItem.priority).toBe("High");
    expect(body.actionItem.deadline).toBe("Tomorrow");
    expect(body.actionItem.notes).toBe("Updated notes");
  });

  test("sends notification and email when ownerId changes", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const meetingNote = await seedMeetingNote(user.id);
    const actionItem = await seedActionItem(meetingNote.id, user.id);

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: user.id }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(200);

    // Verify notification created
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, type: "task_assigned" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.body).toBe("Test action item");

    // Verify email sent
    expect(vi.mocked(mockedSendEmail)).toHaveBeenCalledTimes(1);
    const [email, subject] = vi.mocked(mockedSendEmail).mock.calls[0];
    expect(email).toBe(user.email);
    expect(subject).toBe("New action item assigned");
  });

  test("returns 400 for invalid owner (non-member of org)", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    // Create org + membership
    const org = await prisma.organization.create({
      data: {
        name: "Test Org",
        slug: `test-org-${Date.now()}`,
      },
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "admin",
      },
    });

    // Create another user NOT in the org
    const outsider = await createTestUser({ email: "outsider@test.com" });

    const meetingNote = await seedMeetingNote(user.id, { organizationId: org.id });
    const actionItem = await seedActionItem(meetingNote.id, user.id, {
      organizationId: org.id,
    });

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: outsider.id }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ACTION_ITEM_UPDATE");
  });

  test("POST creates manual action item", async () => {
    const user = await createTestUser({ email: "creator@test.com" });
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/action-items/route");
    const response = await POST(
      new Request("http://localhost/api/action-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: "Gửi báo giá",
          deadline: "2026-08-10",
          priority: "High",
          ownerId: user.id,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.actionItem.task).toBe("Gửi báo giá");
    expect(body.actionItem.deadline).toBe("2026-08-10");
    expect(body.actionItem.priority).toBe("High");
    expect(body.actionItem.meetingTitle).toBe("Việc thủ công");

    const prisma = await getPrisma();
    const stored = await prisma.actionItem.findUnique({
      where: { id: body.actionItem.id },
    });
    expect(stored?.task).toBe("Gửi báo giá");
  });

  test("DELETE removes action item for owner", async () => {
    const user = await createTestUser({ email: "deleter@test.com" });
    const meeting = await seedMeetingNote(user.id);
    const action = await seedActionItem(meeting.id, user.id, {
      task: "To discard",
    });
    await setAuthCookie(user.id);

    const { DELETE } = await import("../app/api/action-items/[id]/route");
    const response = await DELETE(
      new Request(`http://localhost/api/action-items/${action.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: action.id }) },
    );
    expect(response.status).toBe(200);

    const prisma = await getPrisma();
    const gone = await prisma.actionItem.findUnique({ where: { id: action.id } });
    expect(gone).toBeNull();
  });

  test("PATCH can update task text", async () => {
    const user = await createTestUser({ email: "patcher@test.com" });
    const meeting = await seedMeetingNote(user.id);
    const action = await seedActionItem(meeting.id, user.id, {
      task: "Old task",
    });
    await setAuthCookie(user.id);

    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${action.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "New task" }),
      }),
      { params: Promise.resolve({ id: action.id }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.actionItem.task).toBe("New task");
  });

  test("org member can update action item in their org", async () => {
    const admin = await createTestUser({ email: "admin@test.com" });
    const member = await createTestUser({ email: "member@test.com" });
    const prisma = await getPrisma();

    const org = await prisma.organization.create({
      data: {
        name: "Shared Org",
        slug: `shared-org-${Date.now()}`,
      },
    });
    await prisma.membership.create({
      data: { userId: admin.id, organizationId: org.id, role: "admin" },
    });
    await prisma.membership.create({
      data: { userId: member.id, organizationId: org.id, role: "member" },
    });

    const meetingNote = await seedMeetingNote(admin.id, { organizationId: org.id });
    const actionItem = await seedActionItem(meetingNote.id, admin.id, {
      organizationId: org.id,
    });

    // member can update admin's action item (same org)
    await setAuthCookie(member.id);
    const { PATCH } = await import("../app/api/action-items/[id]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/action-items/${actionItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "doing" }),
      }),
      { params: Promise.resolve({ id: actionItem.id }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.actionItem.status).toBe("doing");
  });
});
