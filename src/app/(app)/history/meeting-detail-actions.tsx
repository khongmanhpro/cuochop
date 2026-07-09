"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteMeetingNote,
  renameMeetingNote,
  updateMeetingNotesContent,
  type MeetingActionState,
} from "./actions";

const initialState: MeetingActionState = {};

export function MeetingTitleForm({
  meetingId,
  initialTitle,
}: {
  meetingId: string;
  initialTitle: string;
}) {
  const [state, formAction, isPending] = useActionState(
    renameMeetingNote,
    initialState,
  );
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <label
        htmlFor="meeting-title"
        className="block text-[13px] font-semibold uppercase tracking-[0.08em] text-steel"
      >
        Tên cuộc họp
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          id="meeting-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          className="min-h-11 w-full flex-1 rounded-full border border-hairline bg-canvas px-4 text-[16px] font-semibold text-ink outline-none transition focus:border-ink"
          required
        />
        <button
          type="submit"
          disabled={isPending || title.trim() === initialTitle.trim()}
          className="button-tertiary h-11 shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Đang lưu…" : "Lưu tên"}
        </button>
      </div>
      {state.error ? (
        <p className="text-[14px] text-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-[14px] text-success-text" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function MeetingNotesEditForm({
  meetingId,
  mainTopic,
  executiveSummary,
  decisions,
  risksAndBlockers,
  openQuestions,
}: {
  meetingId: string;
  mainTopic: string;
  executiveSummary: string;
  decisions: string;
  risksAndBlockers: string;
  openQuestions: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateMeetingNotesContent,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div>
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Chỉnh sửa notes
        </h2>
        <p className="mt-2 text-[14px] leading-[1.50] text-slate">
          Mỗi dòng là một ý. Action items quản lý trên Action Board (không sửa
          ở đây).
        </p>
      </div>

      <Field
        id="mainTopic"
        name="mainTopic"
        label="Chủ đề chính"
        defaultValue={mainTopic}
        multiline={false}
      />
      <Field
        id="executiveSummary"
        name="executiveSummary"
        label="Tóm tắt điều hành (mỗi dòng một ý)"
        defaultValue={executiveSummary}
        rows={5}
      />
      <Field
        id="decisions"
        name="decisions"
        label="Quyết định (mỗi dòng một quyết định)"
        defaultValue={decisions}
        rows={4}
      />
      <Field
        id="risksAndBlockers"
        name="risksAndBlockers"
        label="Rủi ro / Blockers"
        defaultValue={risksAndBlockers}
        rows={3}
      />
      <Field
        id="openQuestions"
        name="openQuestions"
        label="Câu hỏi còn mở"
        defaultValue={openQuestions}
        rows={3}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="button-primary h-11 px-6 disabled:opacity-50"
        >
          {isPending ? "Đang lưu…" : "Lưu notes"}
        </button>
        {state.error ? (
          <p className="text-[14px] text-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-[14px] text-success-text" role="status">
            {state.success}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  rows = 3,
  multiline = true,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  rows?: number;
  multiline?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-[15px] leading-[1.50] text-ink outline-none transition focus:border-ink";

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold uppercase tracking-[0.08em] text-steel"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue}
          rows={rows}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={name}
          defaultValue={defaultValue}
          className={`${className} min-h-11`}
        />
      )}
    </div>
  );
}

export function DeleteMeetingButton({
  meetingId,
  meetingTitle,
}: {
  meetingId: string;
  meetingTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="button-tertiary h-11 border-error/40 px-5 text-error hover:border-error"
      >
        Xóa cuộc họp
      </button>
    );
  }

  return (
    <form
      action={deleteMeetingNote}
      className="flex flex-col gap-3 rounded-xl border border-error/30 bg-surface p-4 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="meetingId" value={meetingId} />
      <p className="flex-1 text-[14px] leading-[1.50] text-slate">
        Xóa <span className="font-semibold text-ink">{meetingTitle}</span>? Mọi
        action và quyết định gắn với cuộc họp này cũng sẽ bị xóa.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="button-tertiary h-10 px-4"
          onClick={() => setConfirming(false)}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-full bg-error px-4 text-[14px] font-semibold text-on-dark"
        >
          Xác nhận xóa
        </button>
      </div>
    </form>
  );
}
