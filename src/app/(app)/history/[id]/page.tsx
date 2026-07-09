import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CopyFollowUpButton } from "@/components/copy-follow-up-button";
import { formatFollowUpBrief } from "@/lib/follow-up-brief";
import type { VietnameseMeetingNotes } from "@/lib/gemini";
import { findAccessibleMeetingNote } from "@/lib/meeting-access";
import { getSession } from "@/lib/session";
import { textareaFromLines } from "@/lib/meeting-notes-edit";
import { listSpeakers } from "@/lib/meeting-notes-speakers";
import { tagsFromNotesJson } from "@/lib/meeting-tags";
import {
  DeleteMeetingButton,
  MeetingNotesEditForm,
  MeetingTitleForm,
} from "../meeting-detail-actions";
import {
  MeetingTagsForm,
  RegenerateNotesPanel,
  SpeakerRenameForm,
} from "../meeting-retention-panels";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const { id } = await params;
  const meeting = await findAccessibleMeetingNote(user.id, id);
  if (!meeting) notFound();

  const parsed = tryParseNotes(meeting.notesJson);
  const followUpBrief = parsed ? formatFollowUpBrief(parsed) : "";
  const speakers = parsed ? listSpeakers(parsed) : [];
  const tags = tagsFromNotesJson(meeting.notesJson);

  return (
    <main className="page-container space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="page-eyebrow">Chi tiết cuộc họp</p>
          <h1 className="page-title break-words">{meeting.title}</h1>
          <p className="page-description">
            {formatDate(meeting.createdAt)} · {meeting.audioName}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-tab">
              {meeting._count.actionItems} actions
            </span>
            <span className="pill-tab">
              {meeting._count.decisions} decisions
            </span>
            {tags.map((tag) => (
              <span key={tag} className="pill-tab">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/history" className="button-tertiary h-11 px-5">
            ← Lịch sử
          </Link>
          <Link
            href={`/actions?meeting=${meeting.id}`}
            className="button-tertiary h-11 px-5"
          >
            Action Board
          </Link>
          {followUpBrief ? (
            <CopyFollowUpButton
              label="Copy follow-up"
              brief={followUpBrief}
              className="button-primary h-11 px-5"
            />
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
        <MeetingTitleForm meetingId={meeting.id} initialTitle={meeting.title} />
        <div className="mt-6 border-t border-hairline pt-6">
          <MeetingTagsForm meetingId={meeting.id} initialTags={tags} />
        </div>
        <div className="mt-6 border-t border-hairline pt-6">
          <DeleteMeetingButton
            meetingId={meeting.id}
            meetingTitle={meeting.title}
          />
        </div>
      </section>

      {parsed ? (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
              <SpeakerRenameForm meetingId={meeting.id} speakers={speakers} />
            </div>
            <div className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
              <RegenerateNotesPanel meetingId={meeting.id} />
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
            <MeetingNotesEditForm
              meetingId={meeting.id}
              mainTopic={parsed.meetingOverview.mainTopic}
              executiveSummary={textareaFromLines(parsed.executiveSummary)}
              decisions={textareaFromLines(
                meeting.decisions.length > 0
                  ? meeting.decisions.map((d) => d.content)
                  : parsed.decisions,
              )}
              risksAndBlockers={textareaFromLines(parsed.risksAndBlockers)}
              openQuestions={textareaFromLines(parsed.openQuestions)}
            />
          </section>

          <NotesSection title="Nội dung chính (chỉ xem)">
            <div className="space-y-4">
              {parsed.keyDiscussionPoints.map((point) => (
                <div
                  key={`${point.title}-${point.details[0] ?? ""}`}
                  className="rounded-lg border border-hairline bg-surface p-4"
                >
                  <h3 className="text-[16px] font-semibold text-ink">
                    {point.title}
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.50] text-slate">
                    {point.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </NotesSection>

          <NotesSection title="Action items (Action Board)">
            {meeting.actionItems.length > 0 ? (
              <div className="space-y-3">
                {meeting.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-hairline bg-surface p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="pill-tab">{item.priority}</span>
                      <span className="pill-tab">{item.status}</span>
                      <span className="pill-tab">
                        {item.deadline || "Chưa có deadline"}
                      </span>
                    </div>
                    <p className="mt-3 text-[16px] font-semibold text-ink">
                      {item.task}
                    </p>
                    {item.notes ? (
                      <p className="mt-2 text-[14px] text-slate">{item.notes}</p>
                    ) : null}
                    <Link
                      href={`/actions?highlight=${item.id}`}
                      className="mt-3 inline-block text-[14px] font-medium text-brand-blue-deep hover:underline"
                    >
                      Mở trên Action Board →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <BulletList
                items={parsed.actionItems.map(
                  (item) =>
                    `${item.task} — ${item.owner} — ${item.deadline} (${item.priority})`,
                )}
              />
            )}
          </NotesSection>

          <NotesSection title="Transcript">
            <details className="rounded-lg border border-hairline bg-surface p-4">
              <summary className="cursor-pointer text-[16px] font-semibold text-ink">
                Hiện transcript ({parsed.transcript.segments.length} đoạn)
              </summary>
              <div className="mt-4 max-h-[32rem] space-y-3 overflow-auto">
                {parsed.transcript.segments.map((segment, index) => (
                  <div
                    key={`${segment.start}-${segment.speaker}-${index}`}
                    className="border-b border-hairline pb-3 last:border-0"
                  >
                    <p className="text-[13px] font-medium text-steel">
                      {segment.start}
                      {segment.end ? `–${segment.end}` : ""} · {segment.speaker}
                    </p>
                    <p className="mt-1 text-[15px] leading-[1.50] text-ink">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </NotesSection>

          {meeting.markdown ? (
            <NotesSection title="Markdown đã lưu">
              <details className="rounded-lg border border-hairline bg-surface p-4">
                <summary className="cursor-pointer text-[16px] font-semibold text-ink">
                  Xem markdown (cập nhật sau khi Lưu notes)
                </summary>
                <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap text-[13px] leading-[1.50] text-slate">
                  {meeting.markdown}
                </pre>
              </details>
            </NotesSection>
          ) : null}
        </>
      ) : (
        <section className="rounded-xl border border-dashed border-hairline bg-surface p-8">
          <h2 className="text-[20px] font-semibold text-ink">
            Không đọc được notes JSON
          </h2>
          <p className="mt-2 text-[14px] text-slate">
            Cuộc họp vẫn còn trong hệ thống. Bạn có thể xem markdown thô bên
            dưới (nếu có) hoặc xóa bản này.
          </p>
          {meeting.markdown ? (
            <pre className="mt-6 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-4 text-[13px] text-slate">
              {meeting.markdown}
            </pre>
          ) : null}
        </section>
      )}
    </main>
  );
}

function NotesSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
      <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="text-[14px] leading-[1.50] text-steel">Không có nội dung.</p>
    );
  }

  return (
    <ul className="list-disc space-y-2 pl-5 text-[16px] leading-[1.50] text-slate">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
