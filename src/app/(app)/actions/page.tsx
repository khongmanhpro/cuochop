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
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
      <SearchScrollTarget highlightId={params.highlight || params.item || params.meeting} />
      <div className="mb-8 overflow-hidden rounded-xl border border-hairline bg-canvas">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-8">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
              Personal Action Tracker
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
              Action Board
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] leading-[1.50] text-slate">
              Lọc việc theo owner, deadline, blocker; đổi status nhanh và xử lý hàng loạt từ mọi cuộc họp.
            </p>
          </div>
          <div className="flex items-end bg-footer-bg p-8 text-on-dark">
            <div>
              <p className="text-[14px] text-muted">Next capture</p>
              <Link
                href="/app"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-on-dark px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-canvas"
              >
                New Meeting
              </Link>
            </div>
          </div>
        </div>
      </div>
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
      />
    </main>
  );
}
