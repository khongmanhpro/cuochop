import { prisma } from "./db";
import { getUserOrganization } from "./organizations";

export type MeetingAccessScope = {
  userId: string;
  organizationId: string | null;
};

/**
 * Build Prisma where clause so a user only sees meetings they own
 * or that belong to their active organization.
 */
export function buildMeetingNoteAccessWhere(
  scope: MeetingAccessScope,
): { id?: string; userId?: string; organizationId?: string } {
  if (scope.organizationId) {
    return { organizationId: scope.organizationId };
  }
  return { userId: scope.userId };
}

export async function resolveMeetingAccessScope(
  userId: string,
): Promise<MeetingAccessScope> {
  const organization = await getUserOrganization(userId);
  return {
    userId,
    organizationId: organization?.id ?? null,
  };
}

export async function findAccessibleMeetingNote(
  userId: string,
  meetingId: string,
) {
  const scope = await resolveMeetingAccessScope(userId);
  const accessWhere = buildMeetingNoteAccessWhere(scope);

  return prisma.meetingNote.findFirst({
    where: {
      id: meetingId,
      ...accessWhere,
    },
    include: {
      actionItems: {
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      },
      decisions: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { actionItems: true, decisions: true },
      },
    },
  });
}

export async function assertAccessibleMeetingNote(
  userId: string,
  meetingId: string,
) {
  const scope = await resolveMeetingAccessScope(userId);
  const accessWhere = buildMeetingNoteAccessWhere(scope);

  const note = await prisma.meetingNote.findFirst({
    where: {
      id: meetingId,
      ...accessWhere,
    },
  });

  return note;
}
