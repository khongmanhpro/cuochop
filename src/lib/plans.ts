import type { SessionUser } from "./session";

export const FREE_MONTHLY_LIMIT = 5;

function isActivePro(user: SessionUser): boolean {
  if (user.plan !== "pro") return false;
  if (!user.planExpiresAt) return true;
  return user.planExpiresAt > new Date();
}

export function canGenerate(user: SessionUser): boolean {
  if (isActivePro(user)) return true;
  return user.usageThisMonth < FREE_MONTHLY_LIMIT;
}

export function canExportDocx(user: SessionUser): boolean {
  return isActivePro(user);
}

export function canViewHistory(user: SessionUser): boolean {
  return isActivePro(user);
}
