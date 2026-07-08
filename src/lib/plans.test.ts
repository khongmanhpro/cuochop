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

describe("single-user plan gates", () => {
  test("generation is unlocked even when legacy free usage is above limit", () => {
    const user = makeUser({ plan: "free", usageThisMonth: 999 });
    expect(canGenerate(user)).toBe(true);
  });

  test("generation ignores expired legacy paid plans", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() - 1000),
      usageThisMonth: 999,
    });
    expect(canGenerate(user)).toBe(true);
  });

  test("generation ignores expired legacy business organizations", () => {
    const user = makeUser({ plan: "free", usageThisMonth: 999 });
    const organization = makeOrganizationPlan({
      planExpiresAt: new Date(Date.now() - 1000),
    });

    expect(canGenerate(user, organization)).toBe(true);
  });

  test("DOCX export is unlocked for free users", () => {
    expect(canExportDocx(makeUser({ plan: "free" }))).toBe(true);
  });

  test("history is unlocked for free users", () => {
    expect(canViewHistory(makeUser({ plan: "free" }))).toBe(true);
  });
});

describe("PLAN_LIMITS", () => {
  test("keeps legacy plan records but unlocks core free capabilities", () => {
    expect(FREE_MONTHLY_LIMIT).toBe(Number.POSITIVE_INFINITY);
    expect(PLAN_LIMITS.free.monthlyGenerations).toBe(FREE_MONTHLY_LIMIT);
    expect(PLAN_LIMITS.free.features.docxExport).toBe(true);
    expect(PLAN_LIMITS.free.features.history).toBe(true);
    expect(PLAN_LIMITS.free.features.actionBoard).toBe(true);
    expect(PLAN_LIMITS.pro.monthlyGenerations).toBe(null);
    expect(PLAN_LIMITS.business).toEqual(BUSINESS_PLAN);
    expect(BUSINESS_PLAN.features.teamWorkspace).toBe(true);
    expect(BUSINESS_PLAN.features.prioritySupport).toBe(true);
  });
});

describe("canManageTeam", () => {
  test("team management remains limited to active legacy business users", () => {
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
