"use client";

import { useMemo, useState, useTransition } from "react";
import {
  computeManagerDigest,
  type ActionItemStatus,
} from "@/lib/action-items";
import { getErrorMessage, readApiError } from "@/lib/api-client";
import { ManagerDigest } from "@/components/manager-digest";
import { ActionCard } from "@/components/action-card";
import { DecisionLog } from "@/components/decision-log";
import {
  ActionItemsTable,
  BulkActionBar,
  FilterControls,
} from "@/components/action-board-sections";
import {
  type ActionBoardItem,
  type ActionItemPatch,
  type AssignableMember,
  type DecisionConflictItem,
  type DecisionLogItem,
  type Filters,
  type SortMode,
  formatActionBoardBrief,
  hasClearDeadline,
  initialFilters,
  isClearlyOverdue,
  isDueWithinDays,
  sortActionItems,
} from "@/lib/actions-board-helpers";

export type {
  ActionBoardItem,
  AssignableMember,
  DecisionConflictItem,
  DecisionLogItem,
};

export function ActionsBoard({
  initialItems,
  decisions,
  assignableMembers,
  conflicts = [],
  isTeamContext = false,
  initialDeadlineFilter = false,
}: {
  initialItems: ActionBoardItem[];
  decisions: DecisionLogItem[];
  assignableMembers: AssignableMember[];
  conflicts?: DecisionConflictItem[];
  isTeamContext?: boolean;
  initialDeadlineFilter?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters,
    deadline: initialDeadlineFilter ? "next7" : "all",
  });
  const [sortMode, setSortMode] = useState<SortMode>("smart");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const digest = useMemo(
    () =>
      computeManagerDigest(
        items.map((item) => ({
          status: item.status,
          ownerId: item.ownerId,
          deadline: item.deadline,
        })),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const textQuery = filters.query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (filters.status !== "all" && item.status !== filters.status) return false;
        if (filters.priority !== "all" && item.priority !== filters.priority) return false;
        if (filters.owner !== "all" && item.ownerId !== filters.owner) return false;
        if (filters.noOwner && item.ownerId) return false;
        if (filters.blocked && item.status !== "blocked") return false;
        if (filters.deadline === "overdue" && !isClearlyOverdue(item.deadline)) return false;
        if (filters.deadline === "next7" && !isDueWithinDays(item.deadline, 7)) return false;
        if (filters.deadline === "unclear" && hasClearDeadline(item.deadline)) return false;
        if (
          textQuery &&
          ![item.task, item.notes, item.ownerName, item.meetingTitle]
            .join(" ")
            .toLowerCase()
            .includes(textQuery)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => sortActionItems(a, b, sortMode));
  }, [filters, items, sortMode]);

  const selectedCount = selectedIds.size;
  const selectedVisibleCount = filteredItems.filter((item) => selectedIds.has(item.id)).length;
  const allVisibleSelected = filteredItems.length > 0 && selectedVisibleCount === filteredItems.length;
  const hasActiveFilters =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.owner !== "all" ||
    filters.query.trim().length > 0 ||
    filters.noOwner ||
    filters.blocked ||
    filters.deadline !== "all" ||
    sortMode !== "smart";

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function requestPatchActionItem(id: string, payload: ActionItemPatch) {
    const response = await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await readApiError(
        response,
        "Không thể cập nhật action item. Vui lòng thử lại.",
      );
    }

    const body = (await response.json()) as {
      actionItem?: Partial<ActionBoardItem>;
    };
    return body.actionItem;
  }

  function mergeActionItem(id: string, actionItem?: Partial<ActionBoardItem>) {
    if (!actionItem) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...actionItem,
              createdAt: item.createdAt,
              meetingTitle: item.meetingTitle,
              audioName: item.audioName,
            }
          : item,
      ),
    );
  }

  function patchActionItem(id: string, payload: ActionItemPatch) {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const actionItem = await requestPatchActionItem(id, payload);
          mergeActionItem(id, actionItem);
          setEditingId(null);
        } catch (updateError) {
          setError(getErrorMessage(updateError, "Không thể cập nhật action item."));
        }
      })();
    });
  }

  function bulkPatchStatus(status: ActionItemStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setError(null);
    startTransition(() => {
      void (async () => {
        const results = await Promise.allSettled(
          ids.map(async (id) => ({
            id,
            actionItem: await requestPatchActionItem(id, { status }),
          })),
        );

        const successfulIds = new Set<string>();
        let failures = 0;

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            successfulIds.add(result.value.id);
            mergeActionItem(result.value.id, result.value.actionItem);
          } else {
            failures += 1;
          }
        });

        setSelectedIds((current) => {
          const next = new Set(current);
          successfulIds.forEach((id) => next.delete(id));
          return next;
        });

        if (failures > 0) {
          setError(`${failures} action item chưa cập nhật được. Vui lòng thử lại.`);
        }
      })();
    });
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredItems.forEach((item) => {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  }

  function resetFilters() {
    setFilters(initialFilters);
    setSortMode("smart");
  }

  return (
    <div className="space-y-6">
      <ManagerDigest digest={digest} isTeamContext={isTeamContext} />

      <FilterControls
        filters={filters}
        sortMode={sortMode}
        filteredCount={filteredItems.length}
        totalCount={items.length}
        hasActiveFilters={hasActiveFilters}
        assignableMembers={assignableMembers}
        updateFilter={updateFilter}
        setSortMode={setSortMode}
        resetFilters={resetFilters}
        brief={formatActionBoardBrief(filteredItems, decisions)}
      />

      {selectedCount > 0 ? (
        <BulkActionBar
          selectedCount={selectedCount}
          selectedVisibleCount={selectedVisibleCount}
          isPending={isPending}
          onBulkPatchStatus={bulkPatchStatus}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      ) : null}

      <ActionItemsTable
        items={filteredItems}
        editingId={editingId}
        isPending={isPending}
        selectedIds={selectedIds}
        isTeamContext={isTeamContext}
        assignableMembers={assignableMembers}
        onToggleSelected={toggleSelected}
        onToggleAllVisible={toggleAllVisible}
        allVisibleSelected={allVisibleSelected}
        onEdit={setEditingId}
        onCancelEdit={() => setEditingId(null)}
        onPatch={patchActionItem}
      />

      <DecisionLog decisions={decisions} conflicts={conflicts} />
    </div>
  );
}
