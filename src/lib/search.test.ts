import { beforeEach, describe, expect, test, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("./db", () => dbMock);

import { escapeSql, sanitizeFtsQuery, searchContent } from "./search";

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

  test("returns empty array for query shorter than 2 chars after sanitize", async () => {
    await searchContent("a", "user-1");
    expect(dbMock.prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test("returns empty array for query that becomes empty after sanitize", async () => {
    await searchContent("OR", "user-1");
    expect(dbMock.prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("sanitizeFtsQuery", () => {
  test("passes through plain text", () => {
    expect(sanitizeFtsQuery("meeting notes")).toBe("meeting notes");
  });

  test("passes through Vietnamese text", () => {
    expect(sanitizeFtsQuery("cuộc họp")).toBe("cuộc họp");
  });

  test("strips single quotes", () => {
    expect(sanitizeFtsQuery("don't")).toBe("don t");
  });

  test("strips double quotes", () => {
    expect(sanitizeFtsQuery('"hello"')).toBe("hello");
  });

  test("strips FTS5 wildcard asterisk", () => {
    expect(sanitizeFtsQuery("hello*")).toBe("hello");
  });

  test("strips FTS5 parentheses", () => {
    expect(sanitizeFtsQuery("(hello)")).toBe("hello");
  });

  test("strips FTS5 colon", () => {
    expect(sanitizeFtsQuery("title:hello")).toBe("title hello");
  });

  test("strips FTS5 caret", () => {
    expect(sanitizeFtsQuery("hello^2")).toBe("hello 2");
  });

  test("strips FTS5 tilde", () => {
    expect(sanitizeFtsQuery("hello~10")).toBe("hello 10");
  });

  test("strips FTS5 hyphen", () => {
    expect(sanitizeFtsQuery("hello-world")).toBe("hello world");
  });

  test("strips FTS5 OR keyword as whole word", () => {
    expect(sanitizeFtsQuery("hello OR world")).toBe("hello world");
  });

  test("strips FTS5 AND keyword as whole word", () => {
    expect(sanitizeFtsQuery("hello AND world")).toBe("hello world");
  });

  test("strips FTS5 NOT keyword as whole word", () => {
    expect(sanitizeFtsQuery("hello NOT world")).toBe("hello world");
  });

  test("strips FTS5 NEAR keyword as whole word", () => {
    expect(sanitizeFtsQuery("hello NEAR world")).toBe("hello world");
  });

  test("does NOT strip OR when it is part of a word", () => {
    expect(sanitizeFtsQuery("ORDER")).toBe("ORDER");
  });

  test("does NOT strip AND when it is part of a word", () => {
    expect(sanitizeFtsQuery("ANDREW")).toBe("ANDREW");
  });

  test("strips SQL semicolon", () => {
    expect(sanitizeFtsQuery("hello;")).toBe("hello");
  });

  test("strips SQL comment marker", () => {
    expect(sanitizeFtsQuery("hello--world")).toBe("hello world");
  });

  test("strips angle brackets", () => {
    expect(sanitizeFtsQuery("<script>")).toBe("script");
  });

  test("strips pipe and ampersand", () => {
    expect(sanitizeFtsQuery("a|b&c")).toBe("a b c");
  });

  test("strips backslash", () => {
    expect(sanitizeFtsQuery("a\\b")).toBe("a b");
  });

  test("strips equals and braces", () => {
    expect(sanitizeFtsQuery("a=b{c}")).toBe("a b c");
  });

  test("strips square brackets", () => {
    expect(sanitizeFtsQuery("[hello]")).toBe("hello");
  });

  test("collapses multiple spaces", () => {
    expect(sanitizeFtsQuery("hello world")).toBe("hello world");
  });

  test("trims leading and trailing whitespace", () => {
    expect(sanitizeFtsQuery("  hello  ")).toBe("hello");
  });

  test("caps extremely long input to 1024 chars", () => {
    const long = "a".repeat(2000);
    const result = sanitizeFtsQuery(long);
    expect(result.length).toBe(1024);
  });

  test("returns empty for pure FTS5 operators", () => {
    expect(sanitizeFtsQuery("OR AND NOT NEAR")).toBe("");
  });

  test("handles SQL injection attempt: ' OR '1'='1", () => {
    expect(sanitizeFtsQuery("' OR '1'='1")).toBe("1 1");
  });

  test("handles DROP TABLE attempt", () => {
    expect(sanitizeFtsQuery("'; DROP TABLE users--")).toBe("DROP TABLE users");
  });

  test("handles UNION SELECT attempt", () => {
    expect(sanitizeFtsQuery("' UNION SELECT * FROM users--")).toBe(
      "UNION SELECT FROM users",
    );
  });
});

describe("escapeSql", () => {
  test("escapes single quote by doubling", () => {
    expect(escapeSql("don't")).toBe("don''t");
  });

  test("escapes backslash", () => {
    expect(escapeSql("a\\b")).toBe("a\\\\b");
  });

  test("removes null bytes", () => {
    expect(escapeSql("file\x00name")).toBe("filename");
  });

  test("passes through plain text", () => {
    expect(escapeSql("hello world")).toBe("hello world");
  });

  test("passes through CUID format", () => {
    expect(escapeSql("clxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(
      "clxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  });

  test("escapes multiple single quotes", () => {
    expect(escapeSql("' OR '1'='1")).toBe("'' OR ''1''=''1");
  });

  test("handles empty string", () => {
    expect(escapeSql("")).toBe("");
  });

  test("handles backslash + quote combo", () => {
    expect(escapeSql("\\'")).toBe("\\\\''");
  });
});
