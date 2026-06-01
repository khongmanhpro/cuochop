import { beforeEach, describe, expect, test, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("./db", () => dbMock);

import { buildAuditChanges, getRequestIp, logAudit } from "./audit";

describe("buildAuditChanges", () => {
  test("captures before and after values for changed update fields", () => {
    expect(
      buildAuditChanges({
        action: "update",
        before: { status: "todo", task: "Ship", notes: "same" },
        after: { status: "done", task: "Ship", notes: "same" },
      }),
    ).toEqual({
      status: { before: "todo", after: "done" },
    });
  });

  test("stores snapshots for create and delete actions", () => {
    expect(
      buildAuditChanges({
        action: "create",
        after: { id: "item-1", task: "Ship" },
      }),
    ).toEqual({ after: { id: "item-1", task: "Ship" } });
    expect(
      buildAuditChanges({
        action: "delete",
        before: { id: "item-1", task: "Ship" },
      }),
    ).toEqual({ before: { id: "item-1", task: "Ship" } });
  });
});

describe("getRequestIp", () => {
  test("prefers the first x-forwarded-for address", () => {
    const request = new Request("https://app.example", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "x-real-ip": "198.51.100.2",
      },
    });

    expect(getRequestIp(request)).toBe("203.0.113.1");
  });
});

describe("logAudit", () => {
  beforeEach(() => {
    dbMock.prisma.auditLog.create.mockReset();
  });

  test("writes an AuditLog row with JSON encoded changes", async () => {
    await logAudit({
      organizationId: "org-1",
      userId: "user-1",
      action: "update",
      entityType: "ActionItem",
      entityId: "action-1",
      before: { status: "todo" },
      after: { status: "done" },
      ipAddress: "203.0.113.1",
    });

    expect(dbMock.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        action: "update",
        entityType: "ActionItem",
        entityId: "action-1",
        changes: JSON.stringify({ status: { before: "todo", after: "done" } }),
        ipAddress: "203.0.113.1",
      }),
    });
  });
});
