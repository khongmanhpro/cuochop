import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase text-blue-700">
          Compliance
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">
          Audit log
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Review workspace activity across notes, actions, decisions, members, and exports.
        </p>
      </div>

      <form className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          User
          <select
            name="userId"
            defaultValue={params.userId ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3"
          >
            <option value="">All users</option>
            {users.map((membership) => (
              <option key={membership.user.id} value={membership.user.id}>
                {membership.user.name || membership.user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Entity
          <select
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3"
          >
            <option value="">All entities</option>
            {entityTypes.map((entry) => (
              <option key={entry.entityType} value={entry.entityType}>
                {entry.entityType}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="mt-6 h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Filter
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entity type</th>
                <th className="px-4 py-3 font-semibold">Entity ID</th>
                <th className="px-4 py-3 font-semibold">Changes</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {log.user.name || log.user.email}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.entityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {log.entityId}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {formatChanges(log.changes)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleLogs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No audit logs match these filters.
          </p>
        ) : null}
      </section>

      {nextCursor ? (
        <div className="mt-4 flex justify-end">
          <Link
            href={`/settings/audit?${nextPageParams(params, nextCursor)}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
