import { describe, expect, test } from "vitest";
import {
  canGenerate,
  canExportDocx,
  canViewHistory,
  canManageTeam,
  BUSINESS_PLAN,
  FREE_MONTHLY_LIMIT,
  PLAN_LIMITS,
  type ActiveOrganizationPlan,
} from "./plans";
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

function makeOrganizationPlan(
  overrides: Partial<ActiveOrganizationPlan> = {},
): ActiveOrganizationPlan {
  return {
    id: "org_1",
    name: "Acme",
    slug: "acme",
    plan: "business",
    planExpiresAt: null,
    role: "member",
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

  test("business user ignores usage count", () => {
    const user = makeUser({ plan: "business", usageThisMonth: 999 });
    expect(canGenerate(user)).toBe(true);
  });

  test("pro user with planExpiresAt in future still has pro access", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() + 86400_000),
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    expect(canGenerate(user)).toBe(true);
  });

  test("business organization plan takes precedence over free user usage limit", () => {
    const user = makeUser({
      plan: "free",
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });

    expect(canGenerate(user, makeOrganizationPlan())).toBe(true);
  });

  test("expired business organization plan falls back to individual plan", () => {
    const user = makeUser({
      plan: "free",
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    const organization = makeOrganizationPlan({
      planExpiresAt: new Date(Date.now() - 1000),
    });

    expect(canGenerate(user, organization)).toBe(false);
  });
});

describe("PLAN_LIMITS", () => {
  test("defines free, pro, and business capabilities", () => {
    expect(PLAN_LIMITS.free.monthlyGenerations).toBe(FREE_MONTHLY_LIMIT);
    expect(PLAN_LIMITS.pro.monthlyGenerations).toBe(null);
    expect(PLAN_LIMITS.business).toEqual(BUSINESS_PLAN);
    expect(BUSINESS_PLAN.features.teamWorkspace).toBe(true);
    expect(BUSINESS_PLAN.features.prioritySupport).toBe(true);
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

  test("pro user with null planExpiresAt (lifetime) can export docx", () => {
    expect(canExportDocx(makeUser({ plan: "pro", planExpiresAt: null }))).toBe(true);
  });

  test("business organization member can export docx", () => {
    expect(canExportDocx(makeUser({ plan: "free" }), makeOrganizationPlan())).toBe(
      true,
    );
  });

  test("business user can export docx", () => {
    expect(canExportDocx(makeUser({ plan: "business" }))).toBe(true);
  });
});

describe("canViewHistory", () => {
  test("free user cannot view history", () => {
    expect(canViewHistory(makeUser({ plan: "free" }))).toBe(false);
  });

  test("pro user can view history", () => {
    expect(canViewHistory(makeUser({ plan: "pro" }))).toBe(true);
  });

  test("pro user with null planExpiresAt (lifetime) can view history", () => {
    expect(canViewHistory(makeUser({ plan: "pro", planExpiresAt: null }))).toBe(true);
  });

  test("business organization member can view history", () => {
    expect(canViewHistory(makeUser({ plan: "free" }), makeOrganizationPlan())).toBe(
      true,
    );
  });

  test("business user can view history", () => {
    expect(canViewHistory(makeUser({ plan: "business" }))).toBe(true);
  });
});

describe("canManageTeam", () => {
  test("returns true only for active business users", () => {
    expect(canManageTeam(makeUser({ plan: "business" }))).toBe(true);
    expect(canManageTeam(makeUser({ plan: "pro" }))).toBe(false);
    expect(canManageTeam(makeUser({ plan: "free" }))).toBe(false);
  });

  test("expired business users cannot manage teams", () => {
    expect(
      canManageTeam(
        makeUser({
          plan: "business",
          planExpiresAt: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(false);
  });
});
