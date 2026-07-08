"use client";

import {
  type ProcessStage,
  getStepState,
  statusSteps,
} from "@/lib/use-meeting-notes-pipeline";

export function StatusStepper({ stage }: { stage: ProcessStage }) {
  return (
    <ol className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {statusSteps.map((step) => (
        <li
          key={step.id}
          className={[
            "rounded-md border px-3 py-2 font-medium",
            getStepState(stage, step.id) === "active"
              ? "border-brand-blue-200 bg-brand-blue-200/40 text-brand-blue-deep"
              : getStepState(stage, step.id) === "complete"
                ? "border-success-bg bg-success-bg text-success-text"
                : "border-hairline bg-canvas text-slate",
          ].join(" ")}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
