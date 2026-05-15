import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionsBoard, type ActionBoardItem, type DecisionLogItem } from "./actions-board";
import { prisma } from "@/lib/db";
import { canViewHistory } from "@/lib/plans";
import { getSession } from "@/lib/session";

type RawActionItem = {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
  createdAt: Date;
  meetingNote: {
    title: string;
    audioName: string;
  };
};

type RawDecision = {
  id: string;
  content: string;
  createdAt: Date;
  meetingNote: {
    title: string;
  };
};

export default async function ActionsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  if (!canViewHistory(user)) {
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

  const [actionItems, decisions] = await Promise.all([
    prisma.actionItem.findMany({
      where: { userId: user.id },
      include: {
        meetingNote: {
          select: {
            title: true,
            audioName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.decision.findMany({
      where: { userId: user.id },
      include: {
        meetingNote: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const items: ActionBoardItem[] = (actionItems as RawActionItem[]).map((item) => ({
    id: item.id,
    task: item.task,
    owner: item.owner,
    deadline: item.deadline,
    priority: item.priority,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    meetingTitle: item.meetingNote.title,
    audioName: item.meetingNote.audioName,
  }));

  const decisionItems: DecisionLogItem[] = (decisions as RawDecision[]).map(
    (decision) => ({
      id: decision.id,
      content: decision.content,
      createdAt: decision.createdAt.toISOString(),
      meetingTitle: decision.meetingNote.title,
    }),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
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
      <ActionsBoard initialItems={items} decisions={decisionItems} />
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
