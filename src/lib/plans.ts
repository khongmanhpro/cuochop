import type { SessionUser } from "./session";

// Single-user mode: keep the legacy plan names for DB/backward compatibility,
// but do not gate core utility behind Pro/Business or monthly quota.
export const FREE_MONTHLY_LIMIT = Number.POSITIVE_INFINITY;

export type PlanName = "free" | "pro" | "business";

export type PlanLimit = {
  name: PlanName;
  monthlyGenerations: number | null;
  features: {
    docxExport: boolean;
    history: boolean;
    actionBoard: boolean;
    teamWorkspace: boolean;
    sharedActionBoard: boolean;
    teamManagerDigest: boolean;
    prioritySupport: boolean;
  };
};

export const FREE_PLAN: PlanLimit = {
  name: "free",
  monthlyGenerations: FREE_MONTHLY_LIMIT,
  features: {
    docxExport: true,
    history: true,
    actionBoard: true,
    teamWorkspace: false,
    sharedActionBoard: false,
    teamManagerDigest: false,
    prioritySupport: false,
  },
};

export const PRO_PLAN: PlanLimit = {
  name: "pro",
  monthlyGenerations: null,
  features: {
    docxExport: true,
    history: true,
    actionBoard: true,
    teamWorkspace: false,
    sharedActionBoard: false,
    teamManagerDigest: false,
    prioritySupport: false,
  },
};

export const BUSINESS_PLAN: PlanLimit = {
  name: "business",
  monthlyGenerations: null,
  features: {
    docxExport: true,
    history: true,
    actionBoard: true,
    teamWorkspace: true,
    sharedActionBoard: true,
    teamManagerDigest: true,
    prioritySupport: true,
  },
};

export const PLAN_LIMITS: Record<PlanName, PlanLimit> = {
  free: FREE_PLAN,
  pro: PRO_PLAN,
  business: BUSINESS_PLAN,
};

export type ActiveOrganizationPlan = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planExpiresAt: Date | null;
  role: string;
};

function isActivePlan(
  plan: string,
  planExpiresAt: Date | null,
  expectedPlan: PlanName,
): boolean {
  if (plan !== expectedPlan) return false;
  if (!planExpiresAt) return true;
  return planExpiresAt > new Date();
}

export function canGenerate(
  user: SessionUser,
  organization: ActiveOrganizationPlan | null = null,
): boolean {
  void user;
  void organization;
  return true;
}

export function canExportDocx(
  user: SessionUser,
  organization: ActiveOrganizationPlan | null = null,
): boolean {
  void user;
  void organization;
  return true;
}

export function canViewHistory(
  user: SessionUser,
  organization: ActiveOrganizationPlan | null = null,
): boolean {
  void user;
  void organization;
  return true;
}

export function canManageTeam(user: SessionUser): boolean {
  return isActivePlan(user.plan, user.planExpiresAt, "business");
}
