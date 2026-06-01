import { redirect } from "next/navigation";
import {
  changeTeamMemberRole,
  createTeamOrganization,
  disconnectSlack,
  inviteTeamMember,
  removeTeamMember,
  saveSlackSettings,
} from "./actions";
import { prisma } from "@/lib/db";
import {
  getOrganizationMembers,
  getUserOrganization,
  type OrganizationRole,
} from "@/lib/organizations";
import { buildSlackInstallUrl, listSlackChannels, type SlackChannel } from "@/lib/slack";
import { getSession } from "@/lib/session";
import { CheckoutButton } from "@/app/(marketing)/pricing/checkout-button";

const roles: OrganizationRole[] = ["owner", "admin", "member"];

export default async function TeamSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getUserOrganization(user.id);

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
  const slackSettings = await prisma.organization.findUnique({
    where: { id: activeOrganization.id },
    select: {
      slackAutoPostEnabled: true,
      slackIntegration: true,
    },
  });
  const slackIntegration = slackSettings?.slackIntegration ?? null;
  const slackInstallUrl = canManage
    ? getSlackInstallUrl({
        organizationId: activeOrganization.id,
        userId: user.id,
      })
    : null;
  const slackChannels =
    canManage && slackIntegration
      ? await getSlackChannels(slackIntegration.accessToken)
      : [];

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
            {members.length} member{members.length === 1 ? "" : "s"} · Manage roles,
            invites, and team billing status.
          </p>
        </div>
        <PlanStatus
          organizationId={activeOrganization.id}
          plan={activeOrganization.plan}
          isBusiness={isBusiness}
          isOwner={currentMember?.role === "owner"}
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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Slack integration</h2>
            <p className="mt-1 text-sm text-slate-600">
              Post follow-up briefs and deadline reminders to your team channel.
            </p>
          </div>
          {slackIntegration ? (
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              Connected
            </span>
          ) : (
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
              Not connected
            </span>
          )}
        </div>

        {!canManage ? (
          <p className="mt-3 text-xs text-slate-500">
            Only owners and admins can manage Slack.
          </p>
        ) : slackIntegration ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
            <form action={saveSlackSettings} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="hidden"
                name="organizationId"
                value={activeOrganization.id}
              />
              <label className="text-sm font-medium text-slate-700">
                Posting channel
                <select
                  name="channelId"
                  defaultValue={slackIntegration.channelId ?? ""}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Choose a channel</option>
                  {slackChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="autoPostEnabled"
                  defaultChecked={Boolean(slackSettings?.slackAutoPostEnabled)}
                  className="h-4 w-4"
                />
                Auto-post briefs
              </label>
              <button
                type="submit"
                className="h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 sm:col-span-2"
              >
                Save Slack settings
              </button>
            </form>
            <form action={disconnectSlack}>
              <input
                type="hidden"
                name="organizationId"
                value={activeOrganization.id}
              />
              <button
                type="submit"
                className="h-10 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : slackInstallUrl ? (
          <a
            href={slackInstallUrl}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-[#4A154B] px-4 text-sm font-semibold text-white hover:bg-[#3b103c]"
          >
            Connect Slack
          </a>
        ) : (
          <p className="mt-3 text-sm text-amber-700">
            Slack environment variables are missing.
          </p>
        )}
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

function getSlackInstallUrl({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SESSION_SECRET) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return buildSlackInstallUrl({
    organizationId,
    userId,
    redirectUri: `${baseUrl}/api/integrations/slack/callback`,
  });
}

async function getSlackChannels(encryptedAccessToken: string): Promise<SlackChannel[]> {
  try {
    return await listSlackChannels(encryptedAccessToken);
  } catch (error) {
    console.warn("[slack] failed to list channels", error);
    return [];
  }
}

function PlanStatus({
  organizationId,
  plan,
  isBusiness,
  isOwner,
}: {
  organizationId: string;
  plan: string;
  isBusiness: boolean;
  isOwner: boolean;
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
      {isOwner ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/export?format=json"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export JSON
          </a>
          <a
            href="/api/export?format=csv"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>
      ) : null}
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
