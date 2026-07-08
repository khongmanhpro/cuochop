"use client";

import {
  type ProcessStage,
  statusSteps,
} from "@/lib/use-meeting-notes-pipeline";
import { StatusStepper } from "@/components/status-stepper";

export function UploadProgressBar({
  stage,
  uploadProgress,
  uploadedChunks,
  totalChunks,
}: {
  stage: ProcessStage;
  uploadProgress: number;
  uploadedChunks: number;
  totalChunks: number;
}) {
  if (stage === "idle") {
    return null;
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div aria-live="polite">
          <p className="text-base font-semibold text-ink">
            {stage === "uploading"
              ? `Uploading... ${uploadProgress}% (${uploadedChunks}/${totalChunks || 1} chunks)`
              : stage === "transcribing"
                ? "Transcribing..."
                : stage === "generating"
                  ? "Generating notes..."
                  : statusSteps.find((step) => step.id === stage)?.label}
          </p>
          <p className="mt-1 text-sm text-slate">
            {stage === "transcribing"
              ? "Calling Gemini for Vietnamese transcription with timestamps and speaker labels."
              : stage === "generating"
                ? "Creating professional Vietnamese meeting notes and Markdown."
                : "Chunks are uploaded locally before Gemini processing."}
          </p>
        </div>
        <StatusStepper stage={stage} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width:
              stage === "uploading"
                ? `${uploadProgress}%`
                : stage === "transcribing" ||
                    stage === "generating" ||
                    stage === "done"
                  ? "100%"
                  : "100%",
          }}
        />
      </div>
    </div>
  );
}
