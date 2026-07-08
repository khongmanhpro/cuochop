import {
  ACTION_ITEM_STATUSES,
  type ActionItemPriority,
  type ActionItemStatus,
} from "@/lib/action-items";

export type ActionBoardItem = {
  id: string;
  task: string;
  ownerId: string | null;
  ownerName: string;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
  createdAt: string;
  meetingTitle: string;
  audioName: string;
  createdBy: string;
};

export type AssignableMember = {
  id: string;
  label: string;
  email: string;
};

export type DecisionLogItem = {
  id: string;
  content: string;
  createdAt: string;
  meetingTitle: string;
  createdBy: string;
};

export type DecisionConflictItem = {
  id: string;
  decisionId: string;
  conflictingId: string;
  decisionContent: string;
  conflictingContent: string;
  similarity: number;
  reason: string;
};

export type DeadlineFilter = "all" | "overdue" | "next7" | "unclear";
export type SortMode = "smart" | "deadline" | "priority" | "newest" | "status";

export type Filters = {
  status: string;
  priority: string;
  owner: string;
  query: string;
  noOwner: boolean;
  blocked: boolean;
  deadline: DeadlineFilter;
};

export type ActionItemPatch = Partial<{
  ownerId: string | null;
  deadline: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes: string;
}>;

export const initialFilters: Filters = {
  status: "all",
  priority: "all",
  owner: "all",
  query: "",
  noOwner: false,
  blocked: false,
  deadline: "all",
};

export const statusLabels: Record<ActionItemStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
  blocked: "Blocked",
};

const priorityRank: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
  "Chưa xác định": 3,
};

const statusRank: Record<string, number> = {
  blocked: 0,
  doing: 1,
  todo: 2,
  done: 3,
};

export function sortActionItems(a: ActionBoardItem, b: ActionBoardItem, mode: SortMode) {
  if (mode === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (mode === "priority") return comparePriority(a, b) || compareDeadline(a, b) || compareNewest(a, b);
  if (mode === "deadline") return compareDeadline(a, b) || comparePriority(a, b) || compareNewest(a, b);
  if (mode === "status") return compareStatus(a, b) || comparePriority(a, b) || compareDeadline(a, b);

  return (
    donePenalty(a) - donePenalty(b) ||
    blockedPenalty(a) - blockedPenalty(b) ||
    compareDeadline(a, b) ||
    comparePriority(a, b) ||
    compareNewest(a, b)
  );
}

function donePenalty(item: ActionBoardItem) {
  return item.status === "done" ? 1 : 0;
}

function blockedPenalty(item: ActionBoardItem) {
  return item.status === "blocked" ? 0 : 1;
}

function comparePriority(a: ActionBoardItem, b: ActionBoardItem) {
  return (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4);
}

function compareStatus(a: ActionBoardItem, b: ActionBoardItem) {
  return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
}

function compareNewest(a: ActionBoardItem, b: ActionBoardItem) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function compareDeadline(a: ActionBoardItem, b: ActionBoardItem) {
  return deadlineSortValue(a.deadline) - deadlineSortValue(b.deadline);
}

function deadlineSortValue(deadline: string) {
  return parseClearDeadline(deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function isClearlyOverdue(deadline: string) {
  const parsed = parseClearDeadline(deadline);
  if (!parsed) return false;

  const today = getTodayUtc();
  return parsed.getTime() < today;
}

export function isDueWithinDays(deadline: string, days: number) {
  const parsed = parseClearDeadline(deadline);
  if (!parsed) return false;

  const today = getTodayUtc();
  const end = today + days * 24 * 60 * 60 * 1000;
  return parsed.getTime() >= today && parsed.getTime() <= end;
}

export function hasClearDeadline(deadline: string) {
  return Boolean(parseClearDeadline(deadline));
}

function getTodayUtc() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function parseClearDeadline(deadline: string) {
  const text = deadline.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);

  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  if (slash) {
    return new Date(Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])));
  }

  return null;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatActionBoardBrief(
  filteredItems: ActionBoardItem[],
  decisions: DecisionLogItem[],
) {
  const lines: string[] = ["# Follow-up từ Action Board", ""];

  if (decisions.length > 0) {
    lines.push("## Quyết định đã chốt");
    decisions.forEach((d) => lines.push(`- ${d.content}`));
    lines.push("");
  }

  if (filteredItems.length > 0) {
    lines.push("## Action items");
    filteredItems.forEach((item) => {
      const parts = [
        `[${item.priority}] ${item.task}`,
        item.ownerName !== "Unassigned" ? `Owner: ${item.ownerName}` : null,
        item.deadline !== "Chưa xác định" ? `Deadline: ${item.deadline}` : null,
        item.notes ? `Ghi chú: ${item.notes}` : null,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" - ")}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

export const controlClass =
  "mt-1 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-sm text-ink outline-none transition focus:border-brand-blue-deep focus:outline-none";

export const primaryButtonClass =
  "rounded-full bg-primary px-3 py-2 text-xs font-semibold text-on-dark transition hover:bg-charcoal disabled:bg-hairline disabled:text-steel";

export const secondaryButtonClass =
  "rounded-full border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-charcoal transition hover:border-ink hover:text-ink";

export function pillButtonClass(active: boolean) {
  return active
    ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-dark transition hover:bg-charcoal"
    : "rounded-full border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-charcoal transition hover:border-ink hover:text-ink";
}

export { ACTION_ITEM_STATUSES };
