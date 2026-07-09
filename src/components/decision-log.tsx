"use client";

import {
  type DecisionConflictItem,
  type DecisionLogItem,
  formatDate,
} from "@/lib/actions-board-helpers";

export function DecisionLog({
  decisions,
  conflicts = [],
}: {
  decisions: DecisionLogItem[];
  conflicts?: DecisionConflictItem[];
}) {
  return (
    <div className="space-y-4">
      <section className="card-surface p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-ink sm:text-[18px]">
            Nhật ký quyết định
          </h2>
          <span className="text-[12px] font-medium text-steel">
            {decisions.length}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {decisions.length > 0 ? (
            decisions.map((decision) => (
              <div
                key={decision.id}
                data-search-id={decision.id}
                className="rounded-lg border border-hairline-soft bg-surface px-4 py-3"
              >
                <p className="text-[14px] leading-6 text-ink">
                  {decision.content}
                </p>
                <p className="mt-2 text-[12px] text-steel">
                  {decision.meetingTitle} · {decision.createdBy} ·{" "}
                  {formatDate(decision.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[14px] text-steel">Chưa có quyết định nào.</p>
          )}
        </div>
      </section>

      {conflicts.length > 0 ? (
        <section className="rounded-xl border border-error/20 bg-error/5 p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold text-ink sm:text-[18px]">
            Có thể mâu thuẫn ({conflicts.length})
          </h2>
          <div className="mt-4 space-y-3">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="rounded-lg border border-hairline bg-canvas px-4 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-steel">
                  {conflict.reason}
                </p>
                <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                  <div className="rounded-lg border border-hairline-soft bg-surface p-3">
                    <span className="font-semibold text-charcoal">A:</span>{" "}
                    <span className="text-ink">{conflict.decisionContent}</span>
                  </div>
                  <div className="rounded-lg border border-hairline-soft bg-surface p-3">
                    <span className="font-semibold text-charcoal">B:</span>{" "}
                    <span className="text-ink">
                      {conflict.conflictingContent}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-steel">
                  Độ tương đồng: {Math.round(conflict.similarity * 100)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
