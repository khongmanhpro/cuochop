import { beforeEach, describe, expect, test, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("./db", () => dbMock);

import { searchContent } from "./search";

describe("searchContent", () => {
  beforeEach(() => {
    dbMock.prisma.$queryRawUnsafe.mockReset();
    dbMock.prisma.$queryRawUnsafe.mockResolvedValue([]);
  });

  test("uses qualified personal scope filters and weighted FTS ranking", async () => {
    await searchContent("React", "user-1");

    const sql = dbMock.prisma.$queryRawUnsafe.mock.calls
      .map(([query]) => String(query))
      .join("\n");

    expect(sql).toContain("meeting_notes_fts.userId = 'user-1'");
    expect(sql).toContain("decisions_fts.userId = 'user-1'");
    expect(sql).toContain("action_items_fts.userId = 'user-1'");
    expect(sql).toContain("bm25(meeting_notes_fts");
    expect(sql).toContain("bm25(action_items_fts");
  });

  test("uses qualified organization scope filters when orgId is present", async () => {
    await searchContent("React", "user-1", "org-1");

    const sql = dbMock.prisma.$queryRawUnsafe.mock.calls
      .map(([query]) => String(query))
      .join("\n");

    expect(sql).toContain("meeting_notes_fts.organizationId = 'org-1'");
    expect(sql).toContain("decisions_fts.organizationId = 'org-1'");
    expect(sql).toContain("action_items_fts.organizationId = 'org-1'");
    expect(sql).not.toContain("userId = 'user-1'");
  });
});
