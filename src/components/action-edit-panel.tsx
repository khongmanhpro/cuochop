"use client";

import { useState } from "react";
import {
  ACTION_ITEM_PRIORITIES,
  toDateInputValue,
  type ActionItemPriority,
  type ActionItemStatus,
} from "@/lib/action-items";
import {
  type ActionItemPatch,
  type AssignableMember,
  controlClass,
  primaryButtonClass,
  secondaryButtonClass,
  statusLabels,
} from "@/lib/actions-board-helpers";

export type ActionDraft = {
  task: string;
  ownerId: string;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
};

export function ActionEditPanel({
  task,
  initialDraft,
  isPending,
  showCreatedBy,
  createdBy,
  meetingTitle,
  assignableMembers,
  onSave,
  onCancel,
}: {
  task: string;
  initialDraft: ActionDraft;
  isPending: boolean;
  showCreatedBy: boolean;
  createdBy: string;
  meetingTitle: string;
  assignableMembers: AssignableMember[];
  onSave: (payload: ActionItemPatch) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    ...initialDraft,
    task: initialDraft.task || task,
  });
  const dateValue = toDateInputValue(draft.deadline);

  return (
    <>
      <td className="px-4 py-3">
        <input
          className={controlClass}
          value={draft.task}
          onChange={(event) => setDraft({ ...draft, task: event.target.value })}
          aria-label="Nội dung việc"
        />
      </td>
      <td className="px-4 py-3">
        <OwnerSelect
          value={draft.ownerId}
          members={assignableMembers}
          onChange={(ownerId) => setDraft({ ...draft, ownerId })}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          className={controlClass}
          value={dateValue}
          onChange={(event) =>
            setDraft({ ...draft, deadline: event.target.value })
          }
          aria-label="Deadline"
        />
        {!dateValue && draft.deadline ? (
          <p className="mt-1 text-[11px] text-steel">Gốc: {draft.deadline}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <select
          className={controlClass}
          value={draft.priority}
          onChange={(event) =>
            setDraft({
              ...draft,
              priority: event.target.value as ActionItemPriority,
            })
          }
        >
          {ACTION_ITEM_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <StatusSelect
          value={draft.status}
          disabled={isPending}
          onChange={(status) => setDraft({ ...draft, status })}
        />
      </td>
      {showCreatedBy ? (
        <td className="px-4 py-3 text-xs text-steel">{createdBy}</td>
      ) : null}
      <td className="px-4 py-3 text-xs text-steel">{meetingTitle}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={isPending}
            onClick={() =>
              onSave({
                task: draft.task.trim(),
                ownerId: draft.ownerId || null,
                deadline: draft.deadline,
                priority: draft.priority as ActionItemPriority,
                status: draft.status as ActionItemStatus,
                notes: draft.notes,
              })
            }
          >
            Lưu
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </td>
    </>
  );
}

function OwnerSelect({
  value,
  members,
  onChange,
}: {
  value: string;
  members: AssignableMember[];
  onChange: (ownerId: string) => void;
}) {
  return (
    <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Unassigned</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          @{member.label}
        </option>
      ))}
    </select>
  );
}

export function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: ActionItemStatus) => void;
}) {
  return (
    <select
      className={`${controlClass} min-w-28 disabled:bg-surface disabled:text-steel`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ActionItemStatus)}
    >
      {Object.entries(statusLabels).map(([status, label]) => (
        <option key={status} value={status}>
          {label}
        </option>
      ))}
    </select>
  );
}
