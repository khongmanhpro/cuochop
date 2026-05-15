import { describe, expect, test } from "vitest";
import { canGenerate, canExportDocx, canViewHistory, FREE_MONTHLY_LIMIT } from "./plans";
import type { SessionUser } from "./session";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_1",
    email: "test@example.com",
    name: null,
    plan: "free",
    planExpiresAt: null,
    usageThisMonth: 0,
    usageResetAt: new Date(),
    ...overrides,
  };
}

describe("canGenerate", () => {
  test("free user below limit can generate", () => {
    const user = makeUser({ plan: "free", usageThisMonth: 0 });
    expect(canGenerate(user)).toBe(true);
  });

  test("free user at limit cannot generate", () => {
    const user = makeUser({ plan: "free", usageThisMonth: FREE_MONTHLY_LIMIT });
    expect(canGenerate(user)).toBe(false);
  });

  test("pro user ignores usage count", () => {
    const user = makeUser({ plan: "pro", usageThisMonth: 999 });
    expect(canGenerate(user)).toBe(true);
  });

  test("pro user with expired plan (planExpiresAt in past) is treated as free", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() - 1000),
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    expect(canGenerate(user)).toBe(false);
  });

  test("pro user with planExpiresAt in future still has pro access", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() + 86400_000),
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    expect(canGenerate(user)).toBe(true);
  });
});

describe("canExportDocx", () => {
  test("free user cannot export docx", () => {
    expect(canExportDocx(makeUser({ plan: "free" }))).toBe(false);
  });

  test("pro user can export docx", () => {
    expect(canExportDocx(makeUser({ plan: "pro" }))).toBe(true);
  });

  test("pro user with expired plan cannot export docx", () => {
    const user = makeUser({ plan: "pro", planExpiresAt: new Date(Date.now() - 1000) });
    expect(canExportDocx(user)).toBe(false);
  });
});

describe("canViewHistory", () => {
  test("free user cannot view history", () => {
    expect(canViewHistory(makeUser({ plan: "free" }))).toBe(false);
  });

  test("pro user can view history", () => {
    expect(canViewHistory(makeUser({ plan: "pro" }))).toBe(true);
  });
});
