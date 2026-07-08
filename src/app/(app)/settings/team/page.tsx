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

const roles: OrganizationRole[] = ["owner", "admin", "member"];

export default async function TeamSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getUserOrganization(user.id);

  if (!activeOrganization) {
    return (
      <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
        <section className="rounded-xl border border-hairline bg-canvas p-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
            Team workspace
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
            Create a team workspace
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.50] text-slate">
            Team workspaces share action boards and decision logs across members.
          </p>
          <form action={createTeamOrganization} className="mt-8 flex max-w-xl gap-3">
            <input
              name="name"
              required
              placeholder="Workspace name"
              className="h-10 min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-4 text-[14px] text-ink placeholder:text-stone focus:border-brand-blue-deep focus:outline-none"
            />
            <button type="submit" className="button-primary">
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
  const isPersonalWorkspace = true;
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
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
            Team settings
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
            {activeOrganization.name}
          </h1>
          <p className="mt-2 text-[16px] leading-[1.50] text-slate">
            {members.length} member{members.length === 1 ? "" : "s"} · Manage roles,
            invites, Slack integration, and personal data exports.
          </p>
        </div>
        <PlanStatus
          organizationId={activeOrganization.id}
          plan={isPersonalWorkspace ? "personal" : activeOrganization.plan}
          isOwner={currentMember?.role === "owner"}
        />
      </div>

      <section className="rounded-xl border border-hairline bg-canvas p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">Invite member</h2>
        <form
          action={inviteTeamMember}
          className="mt-6 grid gap-3 md:grid-cols-[1fr_160px_auto]"
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
            className="h-10 rounded-md border border-hairline bg-canvas px-4 text-[14px] text-ink placeholder:text-stone focus:border-brand-blue-deep focus:outline-none disabled:bg-surface"
          />
          <select
            name="role"
            disabled={!canManage}
            defaultValue="member"
            className="h-10 rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none disabled:bg-surface"
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
            className="button-primary disabled:!bg-hairline disabled:!text-muted"
          >
            Invite
          </button>
        </form>
        {!canManage ? (
          <p className="mt-3 text-[14px] leading-[1.50] text-steel">
            Only owners and admins can invite or manage members.
          </p>
        ) : null}
      </section>

      <section className="mt-8 rounded-xl border border-hairline bg-canvas p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">Slack integration</h2>
            <p className="mt-2 text-[14px] leading-[1.50] text-slate">
              Post follow-up briefs and deadline reminders to your team channel.
            </p>
          </div>
          {slackIntegration ? (
            <span className="badge-success">Connected</span>
          ) : (
            <span className="pill-tab">Not connected</span>
          )}
        </div>

        {!canManage ? (
          <p className="mt-4 text-[14px] leading-[1.50] text-steel">
            Only owners and admins can manage Slack.
          </p>
        ) : slackIntegration ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <form action={saveSlackSettings} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="hidden"
                name="organizationId"
                value={activeOrganization.id}
              />
              <label className="text-[14px] font-medium text-charcoal">
                Posting channel
                <select
                  name="channelId"
                  defaultValue={slackIntegration.channelId ?? ""}
                  className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none"
                >
                  <option value="">Choose a channel</option>
                  {slackChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end text-[14px] text-charcoal">
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
                className="button-primary sm:col-span-2"
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
                className="button-tertiary !border-error !text-error"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : slackInstallUrl ? (
          <a
            href={slackInstallUrl}
            className="button-primary mt-6 !bg-[#4A154B] hover:!bg-[#3b103c]"
          >
            Connect Slack
          </a>
        ) : (
          <p className="mt-4 text-[14px] leading-[1.50] text-brand-coral">
            Slack environment variables are missing.
          </p>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-hairline bg-canvas">
        <div className="border-b border-hairline-soft px-8 py-5">
          <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Name</th>
                <th className="px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Email</th>
                <th className="px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Role</th>
                <th className="px-8 py-3 text-[13px] font-semibold uppercase tracking-[0.04em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-t border-hairline-soft">
                  <td className="px-8 py-4 font-medium text-ink">
                    {member.name || "Unnamed"}
                  </td>
                  <td className="px-8 py-4 text-slate">{member.email}</td>
                  <td className="px-8 py-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-8 py-4">
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
                          className="h-9 rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink focus:border-brand-blue-deep focus:outline-none disabled:bg-surface"
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
                          className="button-tertiary h-9 px-3 text-[13px] disabled:!text-stone"
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
                          className="button-tertiary h-9 px-3 text-[13px] !border-error !text-error disabled:!border-hairline disabled:!text-stone"
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
        <section className="mt-8 rounded-xl border border-hairline bg-canvas p-8">
          <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">Pending invites</h2>
          <div className="mt-6 space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-hairline px-4 py-3 text-[14px]"
              >
                <span className="text-charcoal">{invite.email}</span>
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
  plan,
  isOwner,
}: {
  organizationId: string;
  plan: string;
  isOwner: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas px-5 py-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-steel">Workspace</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[16px] font-semibold capitalize text-ink">
          {plan}
        </span>
        <span className="badge-success">Core features unlocked</span>
      </div>
      {isOwner ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/export?format=json"
            className="button-tertiary h-9 px-3 text-[13px]"
          >
            Export JSON
          </a>
          <a
            href="/api/export?format=csv"
            className="button-tertiary h-9 px-3 text-[13px]"
          >
            Export CSV
          </a>
        </div>
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: OrganizationRole }) {
  const cls =
    role === "owner"
      ? "badge-beta"
      : role === "admin"
        ? "badge-success"
        : "pill-tab";
  return <span className={cls}>{role}</span>;
}
