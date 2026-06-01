import { redirect } from "next/navigation";
import {
  changeTeamMemberRole,
  createTeamOrganization,
  inviteTeamMember,
  removeTeamMember,
} from "./actions";
import {
  getActiveOrganization,
  getOrganizationMembers,
  type OrganizationRole,
} from "@/lib/organizations";
import { getSession } from "@/lib/session";
import { CheckoutButton } from "@/app/(marketing)/pricing/checkout-button";

const roles: OrganizationRole[] = ["owner", "admin", "member"];

export default async function TeamSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getActiveOrganization(user.id);

  if (!activeOrganization) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase text-blue-700">
            Team workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Create a team workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Team workspaces share action boards and decision logs across members.
          </p>
          <form action={createTeamOrganization} className="mt-6 flex max-w-xl gap-3">
            <input
              name="name"
              required
              placeholder="Workspace name"
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="submit"
              className="h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create team
            </button>
          </form>
        </section>
      </main>
    );
  }

  const { members, pendingInvites } = await getOrganizationMembers({
    actorUserId: user.id,
    organizationId: activeOrganization.id,
  });
  const currentMember = members.find((member) => member.userId === user.id);
  const canManage =
    currentMember?.role === "owner" || currentMember?.role === "admin";
  const isBusiness = activeOrganization.plan === "business";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-700">
            Team settings
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            {activeOrganization.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage members, roles, and team billing status.
          </p>
        </div>
        <PlanStatus
          organizationId={activeOrganization.id}
          plan={activeOrganization.plan}
          isBusiness={isBusiness}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Invite member</h2>
        <form
          action={inviteTeamMember}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]"
        >
          <input
            type="hidden"
            name="organizationId"
            value={activeOrganization.id}
          />
          <input
            type="email"
            name="email"
            required
            disabled={!canManage}
            placeholder="teammate@company.com"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100"
          />
          <select
            name="role"
            disabled={!canManage}
            defaultValue="member"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!canManage}
            className="h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            Invite
          </button>
        </form>
        {!canManage ? (
          <p className="mt-2 text-xs text-slate-500">
            Only owners and admins can invite or manage members.
          </p>
        ) : null}
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium text-slate-950">
                    {member.name || "Unnamed"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{member.email}</td>
                  <td className="px-5 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={changeTeamMemberRole} className="flex gap-2">
                        <input
                          type="hidden"
                          name="organizationId"
                          value={activeOrganization.id}
                        />
                        <input type="hidden" name="userId" value={member.userId} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          disabled={!canManage}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={!canManage}
                          className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:text-slate-400"
                        >
                          Change
                        </button>
                      </form>
                      <form action={removeTeamMember}>
                        <input
                          type="hidden"
                          name="organizationId"
                          value={activeOrganization.id}
                        />
                        <input type="hidden" name="userId" value={member.userId} />
                        <button
                          type="submit"
                          disabled={!canManage || member.userId === user.id}
                          className="h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:border-slate-200 disabled:text-slate-400"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pendingInvites.length > 0 ? (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Pending invites</h2>
          <div className="mt-4 space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{invite.email}</span>
                <RoleBadge role={invite.role} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PlanStatus({
  organizationId,
  plan,
  isBusiness,
}: {
  organizationId: string;
  plan: string;
  isBusiness: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Plan</p>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-sm font-semibold capitalize text-slate-950">
          {plan}
        </span>
        {!isBusiness ? (
          <CheckoutButton
            tier="business"
            organizationId={organizationId}
            className="h-9 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
            wrapperClassName=""
          >
            Upgrade
          </CheckoutButton>
        ) : null}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: OrganizationRole }) {
  const tone =
    role === "owner"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : role === "admin"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`rounded border px-2 py-1 text-xs font-semibold ${tone}`}>
      {role}
    </span>
  );
}
