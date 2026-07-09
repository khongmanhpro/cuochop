import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ActionsBoard,
  type ActionBoardItem,
  type DecisionConflictItem,
  type DecisionLogItem,
} from "@/components/actions-board";
import { prisma } from "@/lib/db";
import { SearchScrollTarget } from "@/components/search-scroll-target";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

type RawActionItem = {
  id: string;
  task: string;
  ownerId: string | null;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
  createdAt: Date;
  meetingNote: {
    title: string;
    audioName: string;
    user: {
      email: string;
      name: string | null;
    };
  };
  owner: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

type RawDecision = {
  id: string;
  content: string;
  createdAt: Date;
  meetingNote: {
    title: string;
    user: {
      email: string;
      name: string | null;
    };
  };
};

type RawConflict = {
  id: string;
  decisionId: string;
  conflictingId: string;
  similarity: number;
  reason: string;
  decision: { content: string };
  conflicting: { content: string };
};

export default async function ActionsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    filter?: string;
    highlight?: string;
    item?: string;
    meeting?: string;
    section?: string;
  }>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");
  const params = searchParams ? await searchParams : {};

  const activeOrganization = await getUserOrganization(user.id);

  const [actionItems, decisions, organizationMembers, rawConflicts] = await Promise.all([
    prisma.actionItem.findMany({
      where: activeOrganization
        ? { organizationId: activeOrganization.id }
        : { userId: user.id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        meetingNote: {
          select: {
            title: true,
            audioName: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.decision.findMany({
      where: activeOrganization
        ? { organizationId: activeOrganization.id }
        : { userId: user.id },
      include: {
        meetingNote: {
          select: {
            title: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    activeOrganization
      ? prisma.membership.findMany({
          where: { organizationId: activeOrganization.id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.decisionConflict.findMany({
      where: activeOrganization
        ? {
            decision: { organizationId: activeOrganization.id },
          }
        : {
            decision: { userId: user.id },
          },
      include: {
        decision: { select: { content: true } },
        conflicting: { select: { content: true } },
      },
      take: 20,
    }),
  ]);

  const items: ActionBoardItem[] = (actionItems as RawActionItem[]).map((item) => ({
    id: item.id,
    task: item.task,
    ownerId: item.ownerId,
    ownerName: item.owner ? item.owner.name || item.owner.email : "Unassigned",
    deadline: item.deadline,
    priority: item.priority,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    meetingTitle: item.meetingNote.title,
    audioName: item.meetingNote.audioName,
    createdBy: item.meetingNote.user.name || item.meetingNote.user.email,
  }));

  const decisionItems: DecisionLogItem[] = (decisions as RawDecision[]).map(
    (decision) => ({
      id: decision.id,
      content: decision.content,
      createdAt: decision.createdAt.toISOString(),
      meetingTitle: decision.meetingNote.title,
      createdBy: decision.meetingNote.user.name || decision.meetingNote.user.email,
    }),
  );

  const conflictItems: DecisionConflictItem[] = (rawConflicts as RawConflict[]).map((c) => ({
    id: c.id,
    decisionId: c.decisionId,
    conflictingId: c.conflictingId,
    decisionContent: c.decision.content,
    conflictingContent: c.conflicting.content,
    similarity: c.similarity,
    reason: c.reason,
  }));

  return (
    <main className="page-container">
      <SearchScrollTarget highlightId={params.highlight || params.item || params.meeting} />
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-eyebrow">Công việc</p>
          <h1 className="page-title">Bảng việc</h1>
          <p className="page-description">
            Lọc theo owner, deadline, blocker; đổi trạng thái nhanh từ mọi cuộc
            họp.
          </p>
        </div>
        <Link href="/app#new-meeting" className="button-primary shrink-0">
          Tạo notes mới
        </Link>
      </header>
      <ActionsBoard
        initialItems={items}
        decisions={decisionItems}
        conflicts={conflictItems}
        assignableMembers={
          activeOrganization
            ? organizationMembers.map((membership) => ({
                id: membership.user.id,
                label: membership.user.name || membership.user.email,
                email: membership.user.email,
              }))
            : [
                {
                  id: user.id,
                  label: user.name || user.email,
                  email: user.email,
                },
              ]
        }
        isTeamContext={Boolean(activeOrganization)}
        initialDeadlineFilter={params.filter === "deadlines"}
        currentUserId={user.id}
      />
    </main>
  );
}
