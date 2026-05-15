import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canViewHistory } from "@/lib/plans";
import { prisma } from "@/lib/db";
import type { MeetingNoteModel } from "@/generated/prisma/models";
import type { VietnameseMeetingNotes } from "@/lib/gemini";

export default async function HistoryPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  if (!canViewHistory(user)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-sm font-semibold uppercase text-amber-700">Tính năng Pro</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Lịch sử cuộc họp</h1>
          <p className="mt-3 text-slate-600">
            Nâng cấp lên Pro để lưu và xem lại toàn bộ lịch sử meeting notes.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Xem plans và nâng cấp
          </Link>
        </div>
      </main>
    );
  }

  const notes = await prisma.meetingNote.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Lịch sử cuộc họp</h1>
        <p className="mt-1 text-sm text-slate-600">
          {notes.length} cuộc họp đã lưu
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Chưa có cuộc họp nào. Generate meeting notes đầu tiên!</p>
          <Link
            href="/app"
            className="mt-4 inline-flex h-10 items-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            New Meeting
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((note: MeetingNoteModel) => {
            const parsed = tryParseNotes(note.notesJson);
            return (
              <div
                key={note.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="mb-3">
                  <h2 className="font-semibold text-slate-950 line-clamp-2">{note.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(note.createdAt)} · {note.audioName}
                  </p>
                </div>

                {parsed ? (
                  <>
                    <p className="mb-3 text-sm text-slate-600 line-clamp-3">
                      {parsed.executiveSummary[0] ?? ""}
                    </p>
                    <div className="flex gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {parsed.decisions.length} decisions
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {parsed.actionItems.length} actions
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function tryParseNotes(json: string): VietnameseMeetingNotes | null {
  try {
    return JSON.parse(json) as VietnameseMeetingNotes;
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
