import { prisma } from "./db";
import type { ActiveOrganizationPlan } from "./plans";

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type OrganizationMember = {
  userId: string;
  email: string;
  name: string | null;
  role: OrganizationRole;
  createdAt: Date;
};

export type PendingOrganizationInvite = {
  id: string;
  email: string;
  role: OrganizationRole;
  createdAt: Date;
};

export type OrganizationMembers = {
  members: OrganizationMember[];
  pendingInvites: PendingOrganizationInvite[];
};

export async function createOrganization({
  userId,
  name,
  slug,
  plan = "free",
}: {
  userId: string;
  name: string;
  slug?: string;
  plan?: "free" | "pro" | "business";
}) {
  const organizationName = name.trim();
  if (!organizationName) {
    throw new Error("Organization name is required.");
  }

  const baseSlug = normalizeSlug(slug || organizationName);
  const organizationSlug = await nextAvailableSlug(baseSlug);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: organizationSlug,
        plan,
        memberships: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });

    return organization;
  });
}

export async function inviteMember({
  actorUserId,
  organizationId,
  email,
  role = "member",
}: {
  actorUserId: string;
  organizationId: string;
  email: string;
  role?: OrganizationRole;
}) {
  assertRole(role);
  await assertCanManageMembers(actorUserId, organizationId);

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Member email is required.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (user) {
    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      create: {
        userId: user.id,
        organizationId,
        role,
      },
      update: { role },
    });

    await prisma.organizationInvite.deleteMany({
      where: { organizationId, email: normalizedEmail },
    });

    return { status: "added" as const, membership };
  }

  const invite = await prisma.organizationInvite.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email: normalizedEmail,
      },
    },
    create: {
      organizationId,
      email: normalizedEmail,
      role,
    },
    update: {
      role,
      acceptedAt: null,
    },
  });

  return { status: "invited" as const, invite };
}

export async function removeMember({
  actorUserId,
  organizationId,
  userId,
}: {
  actorUserId: string;
  organizationId: string;
  userId: string;
}) {
  await assertCanManageMembers(actorUserId, organizationId);
  await assertNotLastOwner(organizationId, userId);

  return prisma.membership.delete({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
}

export async function updateMemberRole({
  actorUserId,
  organizationId,
  userId,
  role,
}: {
  actorUserId: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}) {
  assertRole(role);
  await assertCanManageMembers(actorUserId, organizationId);

  if (role !== "owner") {
    await assertNotLastOwner(organizationId, userId);
  }

  return prisma.membership.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    data: { role },
  });
}

export async function getOrganizationMembers({
  actorUserId,
  organizationId,
}: {
  actorUserId: string;
  organizationId: string;
}): Promise<OrganizationMembers> {
  await assertIsMember(actorUserId, organizationId);

  const [memberships, pendingInvites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    }),
    prisma.organizationInvite.findMany({
      where: {
        organizationId,
        acceptedAt: null,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    members: memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: parseRole(membership.role),
      createdAt: membership.createdAt,
    })),
    pendingInvites: pendingInvites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: parseRole(invite.role),
      createdAt: invite.createdAt,
    })),
  };
}

export async function getActiveOrganization(
  userId: string,
): Promise<ActiveOrganizationPlan | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return null;

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    plan: membership.organization.plan,
    planExpiresAt: membership.organization.planExpiresAt,
    role: membership.role,
  };
}

async function assertCanManageMembers(userId: string, organizationId: string) {
  const membership = await assertIsMember(userId, organizationId);
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Only organization owners and admins can manage members.");
  }
}

async function assertIsMember(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new Error("Organization membership is required.");
  }

  return membership;
}

async function assertNotLastOwner(organizationId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (membership?.role !== "owner") return;

  const owners = await prisma.membership.count({
    where: {
      organizationId,
      role: "owner",
    },
  });

  if (owners <= 1) {
    throw new Error("An organization must keep at least one owner.");
  }
}

function normalizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "team";
}

async function nextAvailableSlug(baseSlug: string) {
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertRole(role: string): asserts role is OrganizationRole {
  if (!ORGANIZATION_ROLES.includes(role as OrganizationRole)) {
    throw new Error("Invalid organization role.");
  }
}

function parseRole(role: string): OrganizationRole {
  assertRole(role);
  return role;
}
