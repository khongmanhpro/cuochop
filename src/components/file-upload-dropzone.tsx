"use client";

import { allowedExtensions } from "@/lib/use-meeting-notes-pipeline";

export function FileUploadDropzone({
  selectedFile,
  isDragging,
  setIsDragging,
  chooseFile,
}: {
  selectedFile: File | null;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  chooseFile: (file: File | undefined) => void;
}) {
  return (
    <label
      className={[
        "block cursor-pointer rounded-lg border border-dashed p-5 transition",
        isDragging
          ? "border-brand-blue-deep bg-brand-blue-200/40"
          : "border-stone bg-surface hover:border-brand-blue-deep hover:bg-brand-blue-200/40",
      ].join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        chooseFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        className="sr-only"
        type="file"
        accept={allowedExtensions}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />
      <span className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-base font-semibold text-ink">
            Kéo thả file ghi âm/video vào đây
          </span>
          <span className="mt-1 block text-sm text-slate">
            hoặc chọn file MP3, MP4, WAV, M4A.
          </span>
          <span className="mt-3 block max-w-full truncate rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-charcoal">
            {selectedFile ? selectedFile.name : "Chưa chọn file"}
          </span>
        </span>
        <span className="button-primary h-11 px-4 text-sm">
          Chọn file
        </span>
      </span>
    </label>
  );
}
