"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  createOrganization,
  inviteMember,
  removeMember,
  updateMemberRole,
  type OrganizationRole,
} from "@/lib/organizations";
import { getSession } from "@/lib/session";

export async function createTeamOrganization(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "");

  await createOrganization({
    userId: user.id,
    name,
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

export async function inviteTeamMember(formData: FormData) {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") || "");
  const email = String(formData.get("email") || "");
  const role = parseRole(String(formData.get("role") || "member"));

  await inviteMember({
    actorUserId: user.id,
    organizationId,
    email,
    role,
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

export async function removeTeamMember(formData: FormData) {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") || "");
  const userId = String(formData.get("userId") || "");

  await removeMember({
    actorUserId: user.id,
    organizationId,
    userId,
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

export async function changeTeamMemberRole(formData: FormData) {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") || "");
  const userId = String(formData.get("userId") || "");
  const role = parseRole(String(formData.get("role") || "member"));

  await updateMemberRole({
    actorUserId: user.id,
    organizationId,
    userId,
    role,
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

export async function saveSlackSettings(formData: FormData) {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") || "");
  const channelId = String(formData.get("channelId") || "");
  const autoPostEnabled = formData.get("autoPostEnabled") === "on";

  await assertCanManageSlack(user.id, organizationId);

  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      slackAutoPostEnabled: true,
      slackIntegration: { select: { channelId: true } },
    },
  });

  await prisma.$transaction([
    prisma.slackIntegration.update({
      where: { organizationId },
      data: { channelId: channelId || null },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: { slackAutoPostEnabled: autoPostEnabled },
    }),
  ]);

  await logAudit({
    organizationId,
    userId: user.id,
    action: "update",
    entityType: "Organization",
    entityId: organizationId,
    before: {
      slackAutoPostEnabled: before?.slackAutoPostEnabled ?? false,
      slackChannelId: before?.slackIntegration?.channelId ?? null,
    },
    after: {
      slackAutoPostEnabled: autoPostEnabled,
      slackChannelId: channelId || null,
    },
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

export async function disconnectSlack(formData: FormData) {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") || "");

  await assertCanManageSlack(user.id, organizationId);

  await prisma.$transaction([
    prisma.slackIntegration.deleteMany({ where: { organizationId } }),
    prisma.organization.update({
      where: { id: organizationId },
      data: { slackAutoPostEnabled: false },
    }),
  ]);

  await logAudit({
    organizationId,
    userId: user.id,
    action: "delete",
    entityType: "SlackIntegration",
    entityId: organizationId,
    before: { organizationId },
    ipAddress: await getActionIp(),
  });

  revalidatePath("/settings/team");
}

async function requireUser() {
  const user = await getSession();
  if (!user) {
    throw new Error("Authentication is required.");
  }
  return user;
}

async function getActionIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return headerStore.get("x-real-ip");
}

function parseRole(value: string): OrganizationRole {
  if (value === "owner" || value === "admin" || value === "member") {
    return value;
  }
  return "member";
}

async function assertCanManageSlack(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (membership?.role !== "owner" && membership?.role !== "admin") {
    throw new Error("Only organization owners and admins can manage Slack.");
  }
}
