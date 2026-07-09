"use client";

import {
  ACTION_ITEM_PRIORITIES,
  ACTION_ITEM_STATUSES,
  type ActionItemStatus,
} from "@/lib/action-items";
import { CopyFollowUpButton } from "@/components/copy-follow-up-button";
import Link from "next/link";
import { ActionCard } from "@/components/action-card";
import { EmptyState } from "@/components/empty-state";
import {
  type ActionBoardItem,
  type ActionItemPatch,
  type AssignableMember,
  type DeadlineFilter,
  type Filters,
  type SortMode,
  controlClass,
  formatDate,
  isClearlyOverdue,
  isDueWithinDays,
  pillButtonClass,
  primaryButtonClass,
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
    <section className="card-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-hairline-soft pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-steel">
            Bộ lọc
          </p>
          <p className="mt-1 text-[14px] text-slate">
            <span className="font-semibold text-ink">{filteredCount}</span>
            <span className="text-steel"> / {totalCount} việc</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={pillButtonClass(filters.blocked)}
            onClick={() => updateFilter("blocked", !filters.blocked)}
          >
            Đang kẹt
          </button>
          <button
            type="button"
            className={pillButtonClass(filters.noOwner)}
            onClick={() => updateFilter("noOwner", !filters.noOwner)}
          >
            Chưa owner
          </button>
          <button
            type="button"
            className={pillButtonClass(filters.deadline === "overdue")}
            onClick={() =>
              updateFilter(
                "deadline",
                filters.deadline === "overdue" ? "all" : "overdue",
              )
            }
          >
            Quá hạn
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              className="button-tertiary h-9 px-3 text-[13px]"
              onClick={resetFilters}
            >
              Xóa lọc
            </button>
          ) : null}
          <CopyFollowUpButton
            label="Copy follow-up"
            copiedLabel="✓ Đã copy"
            brief={brief}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="field-label xl:col-span-2">
          Tìm kiếm
          <input
            className={controlClass}
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Việc, ghi chú, họp, owner…"
          />
        </label>
        <label className="field-label">
          Trạng thái
          <select
            className={controlClass}
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="all">Mọi trạng thái</option>
            {ACTION_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Ưu tiên
          <select
            className={controlClass}
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option value="all">Mọi mức</option>
            {ACTION_ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Owner
          <select
            className={controlClass}
            value={filters.owner}
            onChange={(event) => updateFilter("owner", event.target.value)}
          >
            <option value="all">Mọi người</option>
            {assignableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Deadline
          <select
            className={controlClass}
            value={filters.deadline}
            onChange={(event) =>
              updateFilter("deadline", event.target.value as DeadlineFilter)
            }
          >
            <option value="all">Mọi deadline</option>
            <option value="overdue">Quá hạn</option>
            <option value="next7">7 ngày tới</option>
            <option value="unclear">Chưa rõ</option>
          </select>
        </label>
        <label className="field-label">
          Sắp xếp
          <select
            className={controlClass}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="smart">Ưu tiên thông minh</option>
            <option value="deadline">Deadline gần nhất</option>
            <option value="priority">Ưu tiên cao</option>
            <option value="newest">Mới nhất</option>
            <option value="status">Theo trạng thái</option>
          </select>
        </label>
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
        Đã chọn {selectedCount} việc
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
            Đặt {statusLabels[status]}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-on-dark transition hover:border-on-dark hover:text-on-dark"
          onClick={onClear}
        >
          Bỏ chọn
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
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-hairline-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-ink sm:text-[18px]">
            {items.length} việc
          </h2>
          <p className="mt-0.5 text-[13px] text-steel">
            Mobile: thẻ · Desktop: bảng · Chọn nhiều để đổi trạng thái
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] font-medium text-charcoal">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-hairline text-primary focus:ring-brand-blue-deep"
            checked={allVisibleSelected}
            disabled={items.length === 0}
            onChange={(event) => onToggleAllVisible(event.target.checked)}
          />
          Chọn đang hiện
        </label>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 p-4 md:hidden">
        {items.map((item) => (
          <MobileActionCard
            key={item.id}
            item={item}
            isPending={isPending}
            isSelected={selectedIds.has(item.id)}
            onSelect={(checked) => onToggleSelected(item.id, checked)}
            onEdit={() => onEdit(item.id)}
            onPatch={(payload) => onPatch(item.id, payload)}
          />
        ))}
        {editingId ? (
          <p className="rounded-lg border border-hairline bg-surface p-3 text-sm text-slate">
            Đang sửa trên bảng desktop. Xoay ngang hoặc mở màn hình lớn hơn để chỉnh chi tiết, hoặc
            bấm Done/Reopen trên thẻ.
          </p>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-surface text-steel">
            <tr>
              <th className="w-12 px-4 py-3 font-semibold">Chọn</th>
              <th className="px-4 py-3 font-semibold">Việc</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Deadline</th>
              <th className="px-4 py-3 font-semibold">Ưu tiên</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              {isTeamContext ? (
                <th className="px-4 py-3 font-semibold">Người tạo</th>
              ) : null}
              <th className="px-4 py-3 font-semibold">Nguồn</th>
              <th className="px-4 py-3 font-semibold">Thao tác</th>
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
        <div className="p-4">
          <EmptyState
            icon="✅"
            title="Không có việc phù hợp"
            description="Thử bật «Tất cả», xóa lọc, hoặc thêm việc mới phía trên."
            cta={{ label: "Về dashboard", href: "/app" }}
          />
        </div>
      ) : null}
    </section>
  );
}

function MobileActionCard({
  item,
  isPending,
  isSelected,
  onSelect,
  onEdit,
  onPatch,
}: {
  item: ActionBoardItem;
  isPending: boolean;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onPatch: (payload: ActionItemPatch) => void;
}) {
  const isDone = item.status === "done";
  const overdue = isClearlyOverdue(item.deadline);
  const soon = !overdue && isDueWithinDays(item.deadline, 7);

  return (
    <article
      data-search-id={item.id}
      className="rounded-xl border border-hairline bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-hairline text-primary"
          checked={isSelected}
          onChange={(event) => onSelect(event.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-6 text-ink">{item.task}</p>
          <p className="mt-1 text-xs text-steel">
            {item.ownerName} · {item.meetingTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="pill-tab">{statusLabels[item.status as keyof typeof statusLabels] ?? item.status}</span>
            <span className="pill-tab">{item.priority}</span>
            <span
              className={`pill-tab ${overdue ? "border-error text-error" : soon ? "border-brand-coral text-brand-coral" : ""}`}
            >
              {item.deadline || "Chưa deadline"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-steel">{formatDate(item.createdAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={isDone ? secondaryButtonClass : primaryButtonClass}
              disabled={isPending}
              onClick={() => onPatch({ status: isDone ? "todo" : "done" })}
            >
              {isDone ? "Mở lại" : "Xong"}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={onEdit}
            >
              Sửa
            </button>
            <Link
              href={`/actions?highlight=${item.id}`}
              className="button-tertiary h-10 px-3 text-sm"
            >
              Chi tiết
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
