"use client";

import { useState } from "react";
import type { GeneratedActionItemRef } from "@/lib/notes-client";
import { getErrorMessage, readApiError } from "@/lib/api-client";
import Link from "next/link";

/**
 * Post-save triage after generate-notes.
 * Actions are already persisted; discard = DELETE /api/action-items/[id].
 */
export function ActionTriagePanel({
  meetingNoteId,
  initialItems,
}: {
  meetingNoteId: string;
  initialItems: GeneratedActionItemRef[];
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || initialItems.length === 0) {
    return null;
  }

  if (items.length === 0) {
    return (
      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <p className="text-sm font-medium text-ink">
          Đã bỏ hết action AI. Bạn có thể thêm việc tay trên Action Board.
        </p>
        <Link
          href="/actions"
          className="mt-3 inline-flex text-sm font-semibold text-brand-blue-deep hover:underline"
        >
          Mở Action Board →
        </Link>
      </section>
    );
  }

  async function discard(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/action-items/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw await readApiError(response, "Không xóa được action item.");
      }
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (discardError) {
      setError(getErrorMessage(discardError, "Không xóa được action item."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-brand-coral/40 bg-canvas p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-coral">
            Rà soát action
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            AI vừa tạo {items.length} việc — bỏ việc ảo trước khi tin board
          </h3>
          <p className="mt-1 text-sm text-slate">
            Việc đã lưu vào DB. Bấm <strong>Bỏ</strong> để xóa; giữ lại những
            việc đúng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/history/${meetingNoteId}`}
            className="button-tertiary h-10 px-4 text-sm"
          >
            Xem meeting
          </Link>
          <Link href="/actions" className="button-primary h-10 px-4 text-sm">
            Action Board
          </Link>
          <button
            type="button"
            className="button-tertiary h-10 px-4 text-sm"
            onClick={() => setDismissed(true)}
          >
            Xong
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-ink">{item.task}</p>
              <p className="mt-1 text-xs text-steel">
                {item.priority} · {item.deadline || "Chưa có deadline"} ·{" "}
                {item.status}
              </p>
            </div>
            <button
              type="button"
              className="button-tertiary h-10 shrink-0 border-error/40 px-4 text-sm text-error"
              disabled={pendingId === item.id}
              onClick={() => void discard(item.id)}
            >
              {pendingId === item.id ? "Đang bỏ…" : "Bỏ"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
