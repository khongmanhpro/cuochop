"use client";

import { type ActionItemStatus } from "@/lib/action-items";
import {
  type ActionBoardItem,
  type ActionItemPatch,
  type AssignableMember,
  controlClass,
  formatDate,
  isClearlyOverdue,
  isDueWithinDays,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/actions-board-helpers";
import {
  ActionEditPanel,
  type ActionDraft,
  StatusSelect,
} from "@/components/action-edit-panel";

export function ActionCard({
  item,
  isEditing,
  isPending,
  isSelected,
  showCreatedBy,
  assignableMembers,
  onSelect,
  onEdit,
  onCancel,
  onPatch,
}: {
  item: ActionBoardItem;
  isEditing: boolean;
  isPending: boolean;
  isSelected: boolean;
  showCreatedBy: boolean;
  assignableMembers: AssignableMember[];
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
  onPatch: (payload: ActionItemPatch) => void;
}) {
  const isDone = item.status === "done";
  const quickStatus: ActionItemStatus = isDone ? "todo" : "done";

  const checkboxCell = (
    <td className="px-4 py-3">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-hairline text-primary focus:ring-brand-blue-deep"
        checked={isSelected}
        onChange={(event) => onSelect(event.target.checked)}
      />
    </td>
  );

  if (isEditing) {
    const initialDraft: ActionDraft = {
      task: item.task,
      ownerId: item.ownerId ?? "",
      deadline: item.deadline,
      priority: item.priority,
      status: item.status,
      notes: item.notes,
    };

    return (
      <tr data-search-id={item.id} className="border-t border-hairline-soft bg-surface align-top">
        {checkboxCell}
        <ActionEditPanel
          task={item.task}
          initialDraft={initialDraft}
          isPending={isPending}
          showCreatedBy={showCreatedBy}
          createdBy={item.createdBy}
          meetingTitle={item.meetingTitle}
          assignableMembers={assignableMembers}
          onSave={onPatch}
          onCancel={onCancel}
        />
      </tr>
    );
  }

  return (
    <tr data-search-id={item.id} className="border-t border-hairline-soft align-top transition-colors hover:bg-surface">
      {checkboxCell}
      <td className="px-4 py-3">
        <p className="font-medium leading-6 text-ink">{item.task}</p>
        {item.notes && item.notes !== "Chưa xác định" ? (
          <p className="mt-1 max-w-xl text-xs leading-5 text-steel">{item.notes}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-charcoal">{item.ownerName}</td>
      <td className="px-4 py-3">
        <DeadlineBadge deadline={item.deadline} />
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={item.priority} />
      </td>
      <td className="px-4 py-3">
        <StatusSelect value={item.status} disabled={isPending} onChange={(status) => onPatch({ status })} />
      </td>
      {showCreatedBy ? (
        <td className="px-4 py-3 text-xs text-steel">{item.createdBy}</td>
      ) : null}
      <td className="px-4 py-3 text-xs leading-5 text-steel">
        {item.meetingTitle}
        <br />
        {formatDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={isDone ? secondaryButtonClass : primaryButtonClass}
            disabled={isPending}
            onClick={() => onPatch({ status: quickStatus })}
          >
            {isDone ? "Mở lại" : "Xong"}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onEdit}>
            Sửa
          </button>
        </div>
      </td>
    </tr>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const isHigh = priority === "High";
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        isHigh ? "border-primary text-primary" : "border-hairline bg-surface text-charcoal"
      }`}
    >
      {priority}
    </span>
  );
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const overdue = isClearlyOverdue(deadline);
  const soon = !overdue && isDueWithinDays(deadline, 7);

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        overdue
          ? "border-primary bg-primary text-on-dark"
          : soon
            ? "border-primary text-primary"
            : "border-hairline bg-surface text-charcoal"
      }`}
    >
      {deadline}
    </span>
  );
}
