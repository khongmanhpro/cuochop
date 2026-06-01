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
import { canViewHistory } from "@/lib/plans";
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
    meeting?: string;
    section?: string;
  }>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");
  const params = searchParams ? await searchParams : {};

  const activeOrganization = await getUserOrganization(user.id);

  if (!canViewHistory(user, activeOrganization)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-8">
          <p className="text-sm font-semibold uppercase text-amber-700">
            Pro Manager
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Đừng để action items chết trong biên bản
          </h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Action Board gom việc từ mọi cuộc họp, giúp manager theo dõi owner,
            deadline, blocker và việc quá hạn rõ ràng.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-amber-950 sm:grid-cols-3">
            <ValuePill title="Owner rõ ràng" text="Không còn việc không ai nhận." />
            <ValuePill title="Deadline & status" text="Biết việc nào đang todo, doing, blocked." />
            <ValuePill title="Manager Digest" text="Xem nhanh việc quá hạn và blocked." />
          </div>
          <Link
            href="/pricing"
            className="mt-7 inline-flex h-10 items-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nâng cấp Pro
          </Link>
        </section>
      </main>
    );
  }

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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <SearchScrollTarget highlightId={params.highlight || params.meeting} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-700">
            Pro Action Tracker
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            Action Board
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Theo dõi việc phải làm, blocker và quyết định đã chốt từ mọi cuộc họp.
          </p>
        </div>
        <Link
          href="/app"
          className="inline-flex h-10 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
        >
          New Meeting
        </Link>
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

function ValuePill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-white/60 p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-5">{text}</p>
    </div>
  );
}
