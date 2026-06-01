"use server";

import { revalidatePath } from "next/cache";
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

function parseRole(value: string): OrganizationRole {
  if (value === "owner" || value === "admin" || value === "member") {
    return value;
  }
  return "member";
}
