import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";

const pageSize = 50;

type AuditSearchParams = {
  from?: string;
  to?: string;
  userId?: string;
  entityType?: string;
  cursor?: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<AuditSearchParams>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getUserOrganization(user.id);
  if (
    !activeOrganization ||
    (activeOrganization.role !== "owner" && activeOrganization.role !== "admin")
  ) {
    redirect("/app");
  }

  const params = searchParams ? await searchParams : {};
  const where = {
    organizationId: activeOrganization.id,
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: new Date(params.from) } : {}),
            ...(params.to ? { lte: new Date(params.to) } : {}),
          },
        }
      : {}),
  };

  const [logs, users, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    prisma.membership.findMany({
      where: { organizationId: activeOrganization.id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: activeOrganization.id },
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  const visibleLogs = logs.slice(0, pageSize);
  const nextCursor = logs.length > pageSize ? visibleLogs.at(-1)?.id : null;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
      <div className="mb-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
          Compliance
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
          Audit log
        </h1>
        <p className="mt-2 text-[16px] leading-[1.50] text-slate">
          Review workspace activity across notes, actions, decisions, members, and exports.
        </p>
      </div>

      <form className="mb-8 grid gap-3 rounded-xl border border-hairline bg-canvas p-6 md:grid-cols-5">
        <label className="text-[14px] font-medium text-charcoal">
          From
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none"
          />
        </label>
        <label className="text-[14px] font-medium text-charcoal">
          To
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none"
          />
        </label>
        <label className="text-[14px] font-medium text-charcoal">
          User
          <select
            name="userId"
            defaultValue={params.userId ?? ""}
            className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none"
          >
            <option value="">All users</option>
            {users.map((membership) => (
              <option key={membership.user.id} value={membership.user.id}>
                {membership.user.name || membership.user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[14px] font-medium text-charcoal">
          Entity
          <select
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none"
          >
            <option value="">All entities</option>
            {entityTypes.map((entry) => (
              <option key={entry.entityType} value={entry.entityType}>
                {entry.entityType}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button-primary mt-6">
          Filter
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-hairline bg-canvas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[14px]">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Timestamp</th>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">User</th>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Action</th>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Entity type</th>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Entity ID</th>
                <th className="px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Changes</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id} className="border-t border-hairline-soft align-top">
                  <td className="px-6 py-4 text-slate">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-charcoal">
                    {log.user.name || log.user.email}
                  </td>
                  <td className="px-6 py-4 font-medium text-ink">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 text-charcoal">{log.entityType}</td>
                  <td className="px-6 py-4 font-mono text-[12px] text-steel">
                    {log.entityId}
                  </td>
                  <td className="max-w-md px-6 py-4">
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-[12px] text-charcoal">
                      {formatChanges(log.changes)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleLogs.length === 0 ? (
          <EmptyState
            icon="📭"
            title="Chưa có audit log"
            description="Không có log phù hợp với filter hiện tại. Thử mở rộng khoảng thời gian hoặc xóa filter."
          />
        ) : null}
      </section>

      {nextCursor ? (
        <div className="mt-6 flex justify-end">
          <Link
            href={`/settings/audit?${nextPageParams(params, nextCursor)}`}
            className="button-tertiary"
          >
            Next page
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

function formatChanges(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function nextPageParams(params: AuditSearchParams, cursor: string) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor") next.set(key, value);
  }
  next.set("cursor", cursor);
  return next.toString();
}
