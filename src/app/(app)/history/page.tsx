import Link from "next/link";
import { Suspense } from "react";
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
import { notesMatchTag, tagsFromNotesJson } from "@/lib/meeting-tags";
import { HistoryTagFilter } from "./history-tag-filter";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    highlight?: string;
    meeting?: string;
    section?: string;
    tag?: string;
  }>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");
  const params = searchParams ? await searchParams : {};
  const activeTag = (params.tag || "").trim().toLowerCase();

  const activeOrganization = await getUserOrganization(user.id);

  const notes = await prisma.meetingNote.findMany({
    where: activeOrganization
      ? { organizationId: activeOrganization.id }
      : { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const allTags = Array.from(
    new Set(notes.flatMap((note) => tagsFromNotesJson(note.notesJson))),
  ).sort();

  const filtered = activeTag
    ? notes.filter((note) => notesMatchTag(note.notesJson, activeTag))
    : notes;

  return (
    <main className="page-container">
      <SearchScrollTarget highlightId={params.highlight || params.meeting} />
      <header className="page-header">
        <p className="page-eyebrow">Lịch sử</p>
        <h1 className="page-title">Cuộc họp đã lưu</h1>
        <p className="page-description">
          {filtered.length}
          {activeTag ? ` / ${notes.length}` : ""} cuộc họp
          {activeTag ? ` · thẻ #${activeTag}` : ""}
        </p>
      </header>

      <Suspense fallback={null}>
        <HistoryTagFilter allTags={allTags} activeTag={activeTag} />
      </Suspense>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title={notes.length === 0 ? "Chưa có cuộc họp nào" : "Không có meeting với thẻ này"}
          description={
            notes.length === 0
              ? "Tạo meeting notes đầu tiên để xem lịch sử tại đây."
              : "Thử thẻ khác hoặc bỏ lọc."
          }
          cta={{
            label: notes.length === 0 ? "Tạo meeting đầu tiên" : "Xem tất cả",
            href: notes.length === 0 ? "/app" : "/history",
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note: MeetingNoteModel) => {
            const parsed = tryParseNotes(note.notesJson);
            const tags = tagsFromNotesJson(note.notesJson);
            return (
              <article
                key={note.id}
                data-search-id={note.id}
                className="flex flex-col rounded-xl border border-hairline bg-canvas p-6 transition-colors hover:border-ink"
              >
                <div className="mb-4">
                  <Link href={`/history/${note.id}`} className="group">
                    <h2 className="line-clamp-2 text-[20px] font-semibold leading-[1.40] text-ink group-hover:underline">
                      {note.title}
                    </h2>
                  </Link>
                  <p className="mt-2 text-[14px] leading-[1.50] text-steel">
                    {formatDate(note.createdAt)} · {note.audioName}
                  </p>
                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span key={tag} className="pill-tab text-[12px]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {parsed ? (
                  <>
                    <p className="mb-4 line-clamp-3 flex-1 text-[14px] leading-[1.50] text-slate">
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
                      <Link
                        href={`/history/${note.id}`}
                        className="text-[13px] font-semibold text-brand-blue-deep hover:underline"
                      >
                        Xem chi tiết →
                      </Link>
                    </div>
                  </>
                ) : (
                  <Link
                    href={`/history/${note.id}`}
                    className="text-[13px] font-semibold text-brand-blue-deep hover:underline"
                  >
                    Xem chi tiết →
                  </Link>
                )}
              </article>
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
