"use client";

import { useState, type FormEvent } from "react";
import {
  ACTION_ITEM_PRIORITIES,
  type ActionItemPriority,
} from "@/lib/action-items";
import { getErrorMessage, readApiError } from "@/lib/api-client";
import type {
  ActionBoardItem,
  AssignableMember,
} from "@/lib/actions-board-helpers";
import { controlClass } from "@/lib/actions-board-helpers";

export function CreateActionForm({
  assignableMembers,
  currentUserId,
  onCreated,
}: {
  assignableMembers: AssignableMember[];
  currentUserId?: string;
  onCreated: (item: ActionBoardItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<ActionItemPriority>("Medium");
  const [ownerId, setOwnerId] = useState(currentUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="button-primary h-10 px-4 text-[13px]"
        onClick={() => setOpen(true)}
      >
        + Việc mới
      </button>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!task.trim()) {
      setError("Nhập nội dung việc.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.trim(),
          deadline: deadline || undefined,
          priority,
          ownerId: ownerId || null,
        }),
      });

      if (!response.ok) {
        throw await readApiError(
          response,
          "Không tạo được action item. Vui lòng thử lại.",
        );
      }

      const body = (await response.json()) as { actionItem: ActionBoardItem };
      onCreated(body.actionItem);
      setTask("");
      setDeadline("");
      setPriority("Medium");
      setOwnerId(currentUserId ?? "");
      setOpen(false);
    } catch (createError) {
      setError(getErrorMessage(createError, "Không tạo được action item."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">Việc thủ công</p>
          <h2 className="mt-1 text-[16px] font-semibold text-ink">
            Thêm việc mới
          </h2>
        </div>
        <button
          type="button"
          className="button-tertiary h-9 px-4 text-[13px]"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Đóng
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="field-label md:col-span-2">
          Việc cần làm
          <input
            className={controlClass}
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="VD: Gửi báo giá cho khách A"
            required
          />
        </label>
        <label className="field-label">
          Deadline
          <input
            type="date"
            className={controlClass}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <label className="field-label">
          Ưu tiên
          <select
            className={controlClass}
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as ActionItemPriority)
            }
          >
            {ACTION_ITEM_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {assignableMembers.length > 0 ? (
          <label className="field-label md:col-span-2">
            Owner
            <select
              className={controlClass}
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              <option value="">Chưa gán</option>
              {assignableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <button
          type="submit"
          className="button-primary h-10 px-5 text-[13px]"
          disabled={pending}
        >
          {pending ? "Đang lưu…" : "Lưu việc"}
        </button>
      </div>
    </form>
  );
}
