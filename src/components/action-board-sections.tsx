"use client";

import {
  ACTION_ITEM_PRIORITIES,
  ACTION_ITEM_STATUSES,
  type ActionItemStatus,
} from "@/lib/action-items";
import { CopyFollowUpButton } from "@/components/copy-follow-up-button";
import { ActionCard } from "@/components/action-card";
import {
  type ActionBoardItem,
  type ActionItemPatch,
  type AssignableMember,
  type DeadlineFilter,
  type Filters,
  type SortMode,
  controlClass,
  pillButtonClass,
  secondaryButtonClass,
  statusLabels,
} from "@/lib/actions-board-helpers";

export function FilterControls({
  filters,
  sortMode,
  filteredCount,
  totalCount,
  hasActiveFilters,
  assignableMembers,
  updateFilter,
  setSortMode,
  resetFilters,
  brief,
}: {
  filters: Filters;
  sortMode: SortMode;
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  assignableMembers: AssignableMember[];
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  setSortMode: (mode: SortMode) => void;
  resetFilters: () => void;
  brief: string;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-hairline-soft pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-coral">Focus controls</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Lọc đúng việc cần làm</h2>
          <p className="mt-1 text-sm text-steel">
            {filteredCount}/{totalCount} action items đang hiển thị.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pillButtonClass(filters.blocked)}
            onClick={() => updateFilter("blocked", !filters.blocked)}
          >
            Blocked
          </button>
          <button
            type="button"
            className={pillButtonClass(filters.noOwner)}
            onClick={() => updateFilter("noOwner", !filters.noOwner)}
          >
            No owner
          </button>
          <button
            type="button"
            className={pillButtonClass(filters.deadline === "overdue")}
            onClick={() => updateFilter("deadline", filters.deadline === "overdue" ? "all" : "overdue")}
          >
            Overdue
          </button>
          {hasActiveFilters ? (
            <button type="button" className={secondaryButtonClass} onClick={resetFilters}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-medium text-charcoal xl:col-span-2">
          Search
          <input
            className={controlClass}
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Task, note, meeting, owner..."
          />
        </label>
        <label className="text-sm font-medium text-charcoal">
          Status
          <select
            className={controlClass}
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="all">All status</option>
            {ACTION_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-charcoal">
          Priority
          <select
            className={controlClass}
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option value="all">All priority</option>
            {ACTION_ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-charcoal">
          Owner
          <select
            className={controlClass}
            value={filters.owner}
            onChange={(event) => updateFilter("owner", event.target.value)}
          >
            <option value="all">All owners</option>
            {assignableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-charcoal">
          Deadline
          <select
            className={controlClass}
            value={filters.deadline}
            onChange={(event) => updateFilter("deadline", event.target.value as DeadlineFilter)}
          >
            <option value="all">All deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="next7">Next 7 days</option>
            <option value="unclear">Unclear</option>
          </select>
        </label>
        <label className="text-sm font-medium text-charcoal">
          Sort
          <select
            className={controlClass}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="smart">Smart focus</option>
            <option value="deadline">Deadline gần nhất</option>
            <option value="priority">Priority cao</option>
            <option value="newest">Mới nhất</option>
            <option value="status">Theo status</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <CopyFollowUpButton label="Copy follow-up" brief={brief} />
      </div>
    </section>
  );
}

export function BulkActionBar({
  selectedCount,
  selectedVisibleCount,
  isPending,
  onBulkPatchStatus,
  onClear,
}: {
  selectedCount: number;
  selectedVisibleCount: number;
  isPending: boolean;
  onBulkPatchStatus: (status: ActionItemStatus) => void;
  onClear: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-footer-bg px-4 py-3 text-on-dark sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">
        Đã chọn {selectedCount} action item
        {selectedVisibleCount !== selectedCount ? ` (${selectedVisibleCount} trong bộ lọc hiện tại)` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTION_ITEM_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-on-dark transition hover:border-on-dark hover:text-on-dark disabled:opacity-50"
            disabled={isPending}
            onClick={() => onBulkPatchStatus(status)}
          >
            Set {statusLabels[status]}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-on-dark transition hover:border-on-dark hover:text-on-dark"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </section>
  );
}

export function ActionItemsTable({
  items,
  editingId,
  isPending,
  selectedIds,
  isTeamContext,
  assignableMembers,
  onToggleSelected,
  onToggleAllVisible,
  allVisibleSelected,
  onEdit,
  onCancelEdit,
  onPatch,
}: {
  items: ActionBoardItem[];
  editingId: string | null;
  isPending: boolean;
  selectedIds: Set<string>;
  isTeamContext: boolean;
  assignableMembers: AssignableMember[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  allVisibleSelected: boolean;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onPatch: (id: string, payload: ActionItemPatch) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-canvas">
      <div className="flex flex-col gap-2 border-b border-hairline-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">{items.length} action items</h2>
          <p className="mt-1 text-sm text-steel">Chọn nhiều việc để đổi status hàng loạt, hoặc mark done ngay trên từng dòng.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-charcoal">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-hairline text-primary focus:ring-brand-blue-deep"
            checked={allVisibleSelected}
            disabled={items.length === 0}
            onChange={(event) => onToggleAllVisible(event.target.checked)}
          />
          Select visible
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-surface text-steel">
            <tr>
              <th className="w-12 px-4 py-3 font-semibold">Select</th>
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Deadline</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {isTeamContext ? (
                <th className="px-4 py-3 font-semibold">Created by</th>
              ) : null}
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ActionCard
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                isPending={isPending}
                isSelected={selectedIds.has(item.id)}
                showCreatedBy={isTeamContext}
                assignableMembers={assignableMembers}
                onSelect={(checked) => onToggleSelected(item.id, checked)}
                onEdit={() => onEdit(item.id)}
                onCancel={onCancelEdit}
                onPatch={(payload) => onPatch(item.id, payload)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-base font-semibold text-ink">Không có action item phù hợp.</p>
          <p className="mt-2 text-sm text-steel">Thử reset filter hoặc mở rộng deadline window.</p>
        </div>
      ) : null}
    </section>
  );
}
