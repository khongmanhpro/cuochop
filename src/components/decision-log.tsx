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
    <>
      <section className="rounded-xl border border-hairline bg-canvas p-5">
        <h2 className="text-xl font-semibold text-ink">Decision Log</h2>
        <div className="mt-4 space-y-3">
          {decisions.length > 0 ? (
            decisions.map((decision) => (
              <div
                key={decision.id}
                data-search-id={decision.id}
                className="rounded-lg border border-hairline bg-surface px-4 py-3"
              >
                <p className="text-sm leading-6 text-ink">{decision.content}</p>
                <p className="mt-2 text-xs text-steel">
                  {decision.meetingTitle} · {decision.createdBy} · {formatDate(decision.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-steel">Chưa có decision nào.</p>
          )}
        </div>
      </section>

      {conflicts.length > 0 && (
        <section className="rounded-xl border border-hairline bg-brand-coral/10 p-5">
          <h2 className="text-xl font-semibold text-ink">Potential Conflicts ({conflicts.length})</h2>
          <div className="mt-4 space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-lg border border-hairline bg-canvas px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-steel">{conflict.reason}</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-hairline-soft bg-surface p-3">
                    <span className="font-semibold text-charcoal">A:</span>{" "}
                    <span className="text-ink">{conflict.decisionContent}</span>
                  </div>
                  <div className="rounded-lg border border-hairline-soft bg-surface p-3">
                    <span className="font-semibold text-charcoal">B:</span>{" "}
                    <span className="text-ink">{conflict.conflictingContent}</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-steel">
                  Similarity: {Math.round(conflict.similarity * 100)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
