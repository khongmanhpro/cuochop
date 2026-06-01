import { beforeEach, describe, expect, test, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: {
    decision: {
      findMany: vi.fn(),
    },
    decisionConflict: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./db", () => dbMock);

import { detectConflicts } from "./contradiction-detector";

describe("detectConflicts scoping", () => {
  beforeEach(() => {
    dbMock.prisma.decision.findMany.mockReset();
    dbMock.prisma.decision.findMany.mockResolvedValue([]);
  });

  test("limits personal conflict checks to the creating user", async () => {
    await detectConflicts("decision-1", "Team sẽ bật tính năng search", null, "user-1");

    expect(dbMock.prisma.decision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          id: { not: "decision-1" },
        },
      }),
    );
  });
});
