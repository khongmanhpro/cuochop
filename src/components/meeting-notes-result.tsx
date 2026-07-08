"use client";

import { formatFollowUpBrief } from "@/lib/follow-up-brief";
import {
  type ErrorState,
  formatBytes,
} from "@/lib/use-meeting-notes-pipeline";
import type {
  VietnameseMeetingNotes,
  VietnameseMeetingTranscript,
} from "@/lib/gemini";
import type { CompleteUploadResponse } from "@/lib/upload-client";

export function MeetingNotesResult({
  uploadResult,
  transcript,
  notes,
  markdown,
  copied,
  copiedFollowUp,
  exportError,
  notesError,
  isExportingDocx,
  onCopyMarkdown,
  onCopyFollowUp,
  onDownloadMarkdown,
  onDownloadDocx,
}: {
  uploadResult: CompleteUploadResponse;
  transcript: VietnameseMeetingTranscript;
  notes: VietnameseMeetingNotes | null;
  markdown: string;
  copied: boolean;
  copiedFollowUp: boolean;
  exportError: ErrorState | null;
  notesError: ErrorState | null;
  isExportingDocx: boolean;
  onCopyMarkdown: () => void;
  onCopyFollowUp: () => void;
  onDownloadMarkdown: () => void;
  onDownloadDocx: () => void;
}) {
  const followUpBrief = notes ? formatFollowUpBrief(notes) : "";
  const canExportMarkdown = Boolean(markdown);
  const canExportDocx = Boolean(notes) && !isExportingDocx;

  return (
    <section
      aria-labelledby="result-title"
      className="border-t border-hairline pt-8"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-success-text">
            Done
          </p>
          <h2 id="result-title" className="mt-1 text-2xl font-semibold">
            {notes ? "Meeting notes generated" : "Transcription completed"}
          </h2>
          <p className="mt-2 text-sm text-slate">
            {notes
              ? "Markdown is ready to copy or download."
              : "Transcript is available. Notes generation did not complete."}
          </p>
        </div>
        <div className="w-full max-w-2xl rounded-lg border border-hairline bg-surface p-3 xl:w-auto">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              className="button-tertiary min-h-10 px-3 text-sm enabled:hover:border-brand-blue-deep enabled:hover:text-brand-blue-deep disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
              disabled={!canExportMarkdown}
              onClick={onCopyMarkdown}
            >
              {copied ? "Copied" : "Copy Markdown"}
            </button>
            <button
              type="button"
              className="button-primary min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:bg-hairline disabled:text-muted"
              disabled={!canExportMarkdown}
              onClick={onDownloadMarkdown}
            >
              Download .md
            </button>
            <button
              type="button"
              className="button-tertiary min-h-10 px-3 text-sm enabled:hover:border-brand-blue-deep enabled:hover:text-brand-blue-deep disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
              disabled={!canExportDocx}
              onClick={onDownloadDocx}
            >
              {isExportingDocx ? "Exporting..." : "Download .docx"}
            </button>
            <button
              type="button"
              className="button-primary min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:bg-hairline disabled:text-muted"
              disabled={!followUpBrief}
              onClick={onCopyFollowUp}
            >
              {copiedFollowUp ? "Follow-up copied" : "Copy Follow-up"}
            </button>
          </div>
        </div>
      </div>

      {exportError ? (
        <ErrorAlert
          className="mt-6"
          title="Không thể xuất DOCX"
          message={exportError.message}
          code={exportError.code}
        />
      ) : null}

      {notesError ? (
        <ErrorAlert
          tone="warning"
          className="mt-6"
          title="Không thể tạo meeting notes"
          message={notesError.message}
          code={notesError.code}
        />
      ) : null}

      <div className="mt-6 rounded-lg border border-success-bg bg-success-bg p-5">
        <h3 className="text-lg font-semibold text-success-text">
          File is ready for transcription
        </h3>
        <dl className="mt-4 grid gap-3 text-sm text-success-text lg:grid-cols-2">
          <ResultMeta label="Upload ID" value={uploadResult.uploadId} />
          <ResultMeta
            label="Original name"
            value={uploadResult.originalName}
          />
          <ResultMeta
            label="Stored path"
            value={uploadResult.storedPath}
          />
          <ResultMeta
            label="Size"
            value={formatBytes(uploadResult.sizeBytes)}
          />
          <ResultMeta
            label="Chunks"
            value={String(uploadResult.totalChunks)}
          />
        </dl>
      </div>

      {notes ? <NotesDisplay notes={notes} markdown={markdown} followUpBrief={followUpBrief} /> : null}

      <div className="mt-6 rounded-lg border border-hairline">
        <article className="p-5">
          <h3 className="text-lg font-semibold">Transcript preview</h3>
          <dl className="mt-4 grid gap-3 text-sm text-charcoal sm:grid-cols-2">
            <ResultMeta
              label="Duration"
              value={transcript.duration || "Chưa xác định"}
            />
            <ResultMeta
              label="Speakers"
              value={transcript.speakers.join(", ")}
            />
          </dl>
          <div className="mt-5 space-y-3">
            {transcript.segments.map((line, index) => (
              <p
                key={`${line.start}-${line.speaker}-${index}`}
                className="rounded-md bg-surface px-3 py-2 text-sm leading-6 text-charcoal"
              >
                <span className="font-semibold text-ink">
                  [{line.start}
                  {line.end ? ` - ${line.end}` : ""}] {line.speaker}:
                </span>{" "}
                {line.text}
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function NotesDisplay({
  notes,
  markdown,
  followUpBrief,
}: {
  notes: VietnameseMeetingNotes;
  markdown: string;
  followUpBrief: string;
}) {
  return (
    <div className="mt-6 divide-y divide-hairline rounded-lg border border-hairline">
      <article className="p-5">
        <h3 className="text-lg font-semibold">
          Tóm tắt điều hành
        </h3>
        <BulletList items={notes.executiveSummary} />
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">
          Thông tin cuộc họp
        </h3>
        <dl className="mt-4 grid gap-3 text-sm text-charcoal sm:grid-cols-2">
          <ResultMeta
            label="Ngôn ngữ"
            value={notes.meetingOverview.language}
          />
          <ResultMeta
            label="Thời lượng"
            value={notes.meetingOverview.duration}
          />
          <ResultMeta
            label="Số người nói"
            value={String(notes.meetingOverview.speakerCount)}
          />
          <ResultMeta
            label="Chủ đề chính"
            value={notes.meetingOverview.mainTopic}
          />
        </dl>
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">Nội dung chính</h3>
        <div className="mt-4 space-y-4">
          {notes.keyDiscussionPoints.map((point) => (
            <section key={point.title}>
              <h4 className="font-semibold text-ink">
                {point.title}
              </h4>
              <BulletList items={point.details} />
            </section>
          ))}
        </div>
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">Quyết định</h3>
        <BulletList items={notes.decisions} />
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">Action Items</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="py-2 pr-3 font-semibold">
                  Việc cần làm
                </th>
                <th className="py-2 pr-3 font-semibold">
                  Người phụ trách
                </th>
                <th className="py-2 pr-3 font-semibold">
                  Deadline
                </th>
                <th className="py-2 pr-3 font-semibold">Ưu tiên</th>
                <th className="py-2 pr-3 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {notes.actionItems.map((item) => (
                <tr
                  key={`${item.task}-${item.owner}-${item.deadline}`}
                  className="border-b border-hairline-soft"
                >
                  <td className="py-3 pr-3">{item.task}</td>
                  <td className="py-3 pr-3">{item.owner}</td>
                  <td className="py-3 pr-3">{item.deadline}</td>
                  <td className="py-3 pr-3">{item.priority}</td>
                  <td className="py-3 pr-3">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <article className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Follow-up Brief
            </h3>
            <p className="mt-1 text-sm text-slate">
              Copy nhanh để gửi team sau cuộc họp. Action Board tự động lưu
              và theo dõi các action items này cho workspace cá nhân.
            </p>
          </div>
          <a
            href="/actions"
            className="button-tertiary h-10 px-4 text-sm enabled:hover:border-brand-blue-deep enabled:hover:text-brand-blue-deep"
          >
            Xem Action Board
          </a>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-footer-bg p-4 text-xs leading-6 text-on-dark">
          {followUpBrief}
        </pre>
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">
          Rủi ro / Blockers
        </h3>
        <BulletList items={notes.risksAndBlockers} />
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">Câu hỏi còn mở</h3>
        <BulletList items={notes.openQuestions} />
      </article>
      <article className="p-5">
        <h3 className="text-lg font-semibold">Markdown preview</h3>
        <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-footer-bg p-4 text-xs leading-6 text-on-dark">
          {markdown}
        </pre>
      </article>
    </div>
  );
}

export function ErrorAlert({
  title,
  message,
  code,
  tone = "error",
  className = "",
}: {
  title: string;
  message: string;
  code?: string;
  tone?: "error" | "warning";
  className?: string;
}) {
  const classes =
    tone === "warning"
      ? "border-brand-coral/30 bg-brand-coral/10 text-brand-coral"
      : "border-error/30 bg-error/10 text-error";

  return (
    <div className={`rounded-lg border p-4 ${classes} ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
      {code ? (
        <p className="mt-2 text-xs font-medium opacity-75">Code: {code}</p>
      ) : null}
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-charcoal">
      {items.length > 0 ? (
        items.map((item) => (
          <li key={item} className="flex gap-2 leading-7">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))
      ) : (
        <li className="leading-7">Chưa xác định</li>
      )}
    </ul>
  );
}

export function ResultMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 break-words rounded-md bg-canvas/70 px-3 py-2">
        {value}
      </dd>
    </div>
  );
}
