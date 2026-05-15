"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ACTION_ITEM_PRIORITIES,
  ACTION_ITEM_STATUSES,
  computeManagerDigest,
  type ActionItemPriority,
  type ActionItemStatus,
} from "@/lib/action-items";
import { getErrorMessage, readApiError } from "@/lib/api-client";

export type ActionBoardItem = {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
  createdAt: string;
  meetingTitle: string;
  audioName: string;
};

export type DecisionLogItem = {
  id: string;
  content: string;
  createdAt: string;
  meetingTitle: string;
};

type Filters = {
  status: string;
  priority: string;
  owner: string;
  noOwner: boolean;
  blocked: boolean;
  overdue: boolean;
};

const initialFilters: Filters = {
  status: "all",
  priority: "all",
  owner: "",
  noOwner: false,
  blocked: false,
  overdue: false,
};

export function ActionsBoard({
  initialItems,
  decisions,
}: {
  initialItems: ActionBoardItem[];
  decisions: DecisionLogItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const digest = useMemo(
    () =>
      computeManagerDigest(
        items.map((item) => ({
          status: item.status,
          owner: item.owner,
          deadline: item.deadline,
        })),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filters.status !== "all" && item.status !== filters.status) return false;
        if (filters.priority !== "all" && item.priority !== filters.priority) return false;
        if (
          filters.owner.trim() &&
          !item.owner.toLowerCase().includes(filters.owner.trim().toLowerCase())
        ) {
          return false;
        }
        if (filters.noOwner && !isMissing(item.owner)) return false;
        if (filters.blocked && item.status !== "blocked") return false;
        if (filters.overdue && !isClearlyOverdue(item.deadline)) return false;
        return true;
      }),
    [filters, items],
  );

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function patchActionItem(id: string, payload: Record<string, string>) {
    setError(null);
    startTransition(async () => {
      try {
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
        const actionItem = body.actionItem;
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
        setEditingId(null);
      } catch (updateError) {
        setError(getErrorMessage(updateError, "Không thể cập nhật action item."));
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DigestCard label="Open actions" value={String(digest.open)} />
        <DigestCard label="Blocked" value={String(digest.blocked)} tone="red" />
        <DigestCard
          label="Chưa có owner"
          value={String(digest.withoutOwner)}
          tone="amber"
        />
        <DigestCard
          label="Quá hạn rõ ràng"
          value={String(digest.clearlyOverdue)}
          tone="amber"
        />
        <DigestCard
          label="Done"
          value={`${Math.round(digest.doneRatio * 100)}%`}
          tone="green"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="all">All</option>
              {ACTION_ITEM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Priority
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2"
              value={filters.priority}
              onChange={(event) => updateFilter("priority", event.target.value)}
            >
              <option value="all">All</option>
              {ACTION_ITEM_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Owner
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
              value={filters.owner}
              onChange={(event) => updateFilter("owner", event.target.value)}
              placeholder="Lọc theo owner"
            />
          </label>
          <FilterToggle
            label="No owner"
            checked={filters.noOwner}
            onChange={(value) => updateFilter("noOwner", value)}
          />
          <FilterToggle
            label="Blocked / Overdue"
            checked={filters.blocked || filters.overdue}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                blocked: value,
                overdue: value,
              }))
            }
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-950">
            {filteredItems.length} action items
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Deadline</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <ActionRow
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  isPending={isPending}
                  onEdit={() => setEditingId(item.id)}
                  onCancel={() => setEditingId(null)}
                  onPatch={(payload) => patchActionItem(item.id, payload)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Không có action item phù hợp bộ lọc.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Decision Log</h2>
        <div className="mt-4 space-y-3">
          {decisions.length > 0 ? (
            decisions.map((decision) => (
              <div
                key={decision.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-sm text-slate-800">{decision.content}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {decision.meetingTitle} · {formatDate(decision.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Chưa có decision nào.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ActionRow({
  item,
  isEditing,
  isPending,
  onEdit,
  onCancel,
  onPatch,
}: {
  item: ActionBoardItem;
  isEditing: boolean;
  isPending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onPatch: (payload: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState({
    owner: item.owner,
    deadline: item.deadline,
    priority: item.priority,
    status: item.status,
    notes: item.notes,
  });

  if (isEditing) {
    return (
      <tr className="border-t border-slate-100 bg-blue-50/40 align-top">
        <td className="px-4 py-3 font-medium text-slate-950">{item.task}</td>
        <td className="px-4 py-3">
          <input
            className="h-9 w-full rounded-md border border-slate-300 px-2"
            value={draft.owner}
            onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <input
            className="h-9 w-full rounded-md border border-slate-300 px-2"
            value={draft.deadline}
            onChange={(event) =>
              setDraft({ ...draft, deadline: event.target.value })
            }
          />
        </td>
        <td className="px-4 py-3">
          <select
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2"
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
        <td className="px-4 py-3 text-xs text-slate-500">{item.meetingTitle}</td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
              disabled={isPending}
              onClick={() => onPatch(draft)}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-950">{item.task}</p>
        {item.notes && item.notes !== "Chưa xác định" ? (
          <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">{item.owner}</td>
      <td className="px-4 py-3">{item.deadline}</td>
      <td className="px-4 py-3">
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">
          {item.priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusSelect
          value={item.status}
          disabled={isPending}
          onChange={(status) => onPatch({ status })}
        />
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {item.meetingTitle}
        <br />
        {formatDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
          onClick={onEdit}
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function StatusSelect({
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
      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ActionItemStatus)}
    >
      {ACTION_ITEM_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function DigestCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "red" | "amber" | "green";
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-white text-slate-950",
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function isMissing(value: string) {
  return value.trim().length === 0 || value.trim() === "Chưa xác định";
}

function isClearlyOverdue(deadline: string) {
  const text = deadline.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  if (iso) {
    return (
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) < today
    );
  }

  if (slash) {
    return (
      Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])) < today
    );
  }

  return false;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
