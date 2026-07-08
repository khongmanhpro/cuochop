import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/db";
import { SearchScrollTarget } from "@/components/search-scroll-target";
import { CopyFollowUpButton } from "@/components/copy-follow-up-button";
import { EmptyState } from "@/components/empty-state";
import { formatFollowUpBrief } from "@/lib/follow-up-brief";
import type { MeetingNoteModel } from "@/generated/prisma/models";
import type { VietnameseMeetingNotes } from "@/lib/gemini";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ highlight?: string; meeting?: string; section?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");
  const params = searchParams ? await searchParams : {};

  const activeOrganization = await getUserOrganization(user.id);

  const notes = await prisma.meetingNote.findMany({
    where: activeOrganization
      ? { organizationId: activeOrganization.id }
      : { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
      <SearchScrollTarget highlightId={params.highlight || params.meeting} />
      <div className="mb-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
          Meeting history
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
          Lịch sử cuộc họp
        </h1>
        <p className="mt-2 text-[16px] leading-[1.50] text-slate">
          {notes.length} cuộc họp đã lưu
        </p>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Chưa có cuộc họp nào"
          description="Generate meeting notes đầu tiên để xem lịch sử tại đây."
          cta={{ label: "Tạo meeting đầu tiên", href: "/app" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note: MeetingNoteModel) => {
            const parsed = tryParseNotes(note.notesJson);
            return (
              <div
                key={note.id}
                data-search-id={note.id}
                className="rounded-xl border border-hairline bg-canvas p-6"
              >
                <div className="mb-4">
                  <h2 className="line-clamp-2 text-[20px] font-semibold leading-[1.40] text-ink">
                    {note.title}
                  </h2>
                  <p className="mt-2 text-[14px] leading-[1.50] text-steel">
                    {formatDate(note.createdAt)} · {note.audioName}
                  </p>
                </div>

                {parsed ? (
                  <>
                    <p className="mb-4 line-clamp-3 text-[14px] leading-[1.50] text-slate">
                      {parsed.executiveSummary[0] ?? ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-beta">
                        {parsed.decisions.length} decisions
                      </span>
                      <span className="badge-success">
                        {parsed.actionItems.length} actions
                      </span>
                      <CopyFollowUpButton brief={formatFollowUpBrief(parsed)} />
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
