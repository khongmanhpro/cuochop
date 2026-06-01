import { prisma } from "./db";

export type AuditAction = "create" | "update" | "delete" | "export";

type AuditValue = string | number | boolean | null | Date | AuditObject | AuditValue[];
type AuditObject = { [key: string]: AuditValue | undefined };

export type LogAuditParams = {
  organizationId?: string | null;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: AuditObject | null;
  after?: AuditObject | null;
  ipAddress?: string | null;
};

export async function logAudit(params: LogAuditParams) {
  const changes = buildAuditChanges({
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
  });

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId || null,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: JSON.stringify(changes),
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.warn("[audit] failed to write audit log", error);
  }
}

export function buildAuditChanges({
  action,
  before,
  after,
}: {
  action: AuditAction;
  before?: AuditObject | null;
  after?: AuditObject | null;
}) {
  if (action === "create" || action === "export") {
    return { after: normalizeAuditObject(after ?? {}) };
  }
  if (action === "delete") {
    return { before: normalizeAuditObject(before ?? {}) };
  }

  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const key of keys) {
    const beforeValue = normalizeAuditValue(before?.[key]);
    const afterValue = normalizeAuditValue(after?.[key]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = { before: beforeValue, after: afterValue };
    }
  }

  return diff;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

function normalizeAuditObject(value: AuditObject) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      normalizeAuditValue(entry),
    ]),
  );
}

function normalizeAuditValue(value: AuditValue | undefined): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => normalizeAuditValue(entry));
  if (value && typeof value === "object") return normalizeAuditObject(value);
  return value ?? null;
}
