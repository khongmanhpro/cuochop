"use client";

import { useActionState, useState, useTransition } from "react";
import { modelOptions } from "@/lib/models";
import {
  renameMeetingSpeakers,
  updateMeetingTags,
  type MeetingActionState,
} from "./actions";

const initialState: MeetingActionState = {};

export function MeetingTagsForm({
  meetingId,
  initialTags,
}: {
  meetingId: string;
  initialTags: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateMeetingTags,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <label
        htmlFor="meeting-tags"
        className="block text-[13px] font-semibold uppercase tracking-[0.08em] text-steel"
      >
        Thẻ (tags)
      </label>
      <input
        id="meeting-tags"
        name="tags"
        defaultValue={initialTags.join(", ")}
        placeholder="vd: weekly, khách hàng, hiring"
        className="min-h-11 w-full rounded-full border border-hairline bg-canvas px-4 text-[15px] text-ink outline-none focus:border-ink"
      />
      <p className="text-[13px] text-steel">
        Phân tách bằng dấu phẩy. Dùng để lọc trên trang Lịch sử.
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="button-tertiary h-10 px-5 disabled:opacity-50"
      >
        {isPending ? "Đang lưu…" : "Lưu thẻ"}
      </button>
      {state.error ? (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success-text" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function SpeakerRenameForm({
  meetingId,
  speakers,
}: {
  meetingId: string;
  speakers: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    renameMeetingSpeakers,
    initialState,
  );

  if (speakers.length === 0) {
    return (
      <p className="text-sm text-steel">
        Chưa có speaker trong transcript để đổi tên.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div>
        <h3 className="text-[18px] font-semibold text-ink">
          Đặt tên người nói
        </h3>
        <p className="mt-1 text-sm text-slate">
          Map Speaker 1/2… thành tên thật. Transcript và markdown sẽ được cập
          nhật.
        </p>
      </div>
      <div className="space-y-3">
        {speakers.map((speaker) => (
          <label key={speaker} className="block text-sm font-medium text-ink">
            {speaker}
            <input
              name={`speaker:${speaker}`}
              defaultValue={speaker}
              className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px] outline-none focus:border-ink"
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="button-primary h-11 px-5 disabled:opacity-50"
      >
        {isPending ? "Đang lưu…" : "Lưu tên speaker"}
      </button>
      {state.error ? (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success-text" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function RegenerateNotesPanel({ meetingId }: { meetingId: string }) {
  const [notesModel, setNotesModel] = useState<string>(
    modelOptions[1]?.value ?? modelOptions[0].value,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegenerate() {
    setMessage(null);
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/meetings/${meetingId}/regenerate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notesModel }),
            },
          );
          const body = (await response.json()) as {
            ok?: boolean;
            error?: { message?: string };
          };
          if (!response.ok || !body.ok) {
            throw new Error(
              body.error?.message || "Tạo lại notes thất bại.",
            );
          }
          setMessage(
            "Đã tạo lại notes từ transcript. Action items trên board được giữ nguyên; Decision Log đã cập nhật. Đang tải lại…",
          );
          window.location.reload();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Tạo lại notes thất bại.",
          );
        }
      })();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[18px] font-semibold text-ink">
          Tạo lại notes (không upload lại)
        </h3>
        <p className="mt-1 text-sm text-slate">
          Dùng transcript đã lưu. Action items hiện có trên board không bị xóa.
          Quyết định sẽ được tạo lại theo notes mới.
        </p>
      </div>
      <label className="block text-sm font-medium text-ink">
        Model
        <select
          className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px]"
          value={notesModel}
          onChange={(event) => setNotesModel(event.target.value)}
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button-primary h-11 px-5 disabled:opacity-50"
        disabled={isPending}
        onClick={handleRegenerate}
      >
        {isPending ? "Đang tạo lại…" : "Tạo lại notes"}
      </button>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-success-text" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
