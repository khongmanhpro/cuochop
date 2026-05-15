"use client";

import { useState } from "react";
import { getErrorCode, getErrorMessage, readApiError } from "@/lib/api-client";
import {
  defaultModel,
  modelOptions,
} from "@/lib/meeting-notes-mock";
import { exportMeetingNotesMarkdown } from "@/lib/exporters/markdown-exporter";
import { formatFollowUpBrief } from "@/lib/follow-up-brief";
import type {
  VietnameseMeetingNotes,
  VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { generateNotesForTranscript } from "@/lib/notes-client";
import { transcribeUploadedFile } from "@/lib/transcribe-client";
import {
  type CompleteUploadResponse,
  createClientUploadId,
  uploadFileInChunks,
  validateClientFile,
} from "@/lib/upload-client";

type ProcessStage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "generating"
  | "done";

type ErrorState = {
  message: string;
  code?: string;
};

const statusSteps: Array<{ id: ProcessStage; label: string }> = [
  { id: "uploading", label: "Uploading" },
  { id: "transcribing", label: "Transcribing" },
  { id: "generating", label: "Generating notes" },
  { id: "done", label: "Done" },
];

const allowedExtensions = ".mp3,.mp4,.wav,.m4a";

export function MeetingNotesGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionModel, setTranscriptionModel] = useState(defaultModel);
  const [notesModel, setNotesModel] = useState(defaultModel);
  const [stage, setStage] = useState<ProcessStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedChunks, setUploadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadResult, setUploadResult] =
    useState<CompleteUploadResponse | null>(null);
  const [transcript, setTranscript] =
    useState<VietnameseMeetingTranscript | null>(null);
  const [notes, setNotes] = useState<VietnameseMeetingNotes | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [appError, setAppError] = useState<ErrorState | null>(null);
  const [notesError, setNotesError] = useState<ErrorState | null>(null);
  const [exportError, setExportError] = useState<ErrorState | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [showDocxUpsell, setShowDocxUpsell] = useState(false);

  const isProcessing =
    stage === "uploading" ||
    stage === "transcribing" ||
    stage === "generating";
  const canGenerate = Boolean(selectedFile) && !isProcessing;
  const showResults = stage === "done" && uploadResult && transcript;
  const canExportMarkdown = Boolean(markdown);
  const canExportDocx = Boolean(notes) && !isExportingDocx;
  const followUpBrief = notes ? formatFollowUpBrief(notes) : "";

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateClientFile(file);

    if (validationError) {
      setAppError({
        message: validationError,
        code: getClientFileErrorCode(file),
      });
      setSelectedFile(null);
      setStage("idle");
      setUploadResult(null);
      setTranscript(null);
      setNotes(null);
      setMarkdown("");
      setNotesError(null);
      setExportError(null);
      setIsExportingDocx(false);
      return;
    }

    setSelectedFile(file);
    setAppError(null);
    setStage("idle");
    setUploadProgress(0);
    setUploadedChunks(0);
    setTotalChunks(0);
    setUploadResult(null);
    setTranscript(null);
    setNotes(null);
    setMarkdown("");
    setNotesError(null);
    setExportError(null);
    setIsExportingDocx(false);
    setCopied(false);
    setCopiedFollowUp(false);
  }

  async function handleGenerate() {
    if (!selectedFile || isProcessing) {
      return;
    }

    const validationError = validateClientFile(selectedFile);
    if (validationError) {
      setAppError({
        message: validationError,
        code: getClientFileErrorCode(selectedFile),
      });
      return;
    }

    try {
      setCopied(false);
      setCopiedFollowUp(false);
      setAppError(null);
      setUploadResult(null);
      setTranscript(null);
      setNotes(null);
      setMarkdown("");
      setNotesError(null);
      setExportError(null);
      setIsExportingDocx(false);
      setStage("uploading");
      setUploadProgress(0);
      setUploadedChunks(0);
      setTotalChunks(Math.max(1, Math.ceil(selectedFile.size / (10 * 1024 * 1024))));

      const result = await uploadFileInChunks({
        file: selectedFile,
        uploadId: createClientUploadId(),
        onProgress: (progress) => {
          setUploadProgress(progress.percent);
          setUploadedChunks(progress.uploadedChunks);
          setTotalChunks(progress.totalChunks);
        },
      });

      setUploadResult(result);
      setStage("transcribing");
      const transcriptResult = await transcribeUploadedFile({
        upload: result,
        transcriptionModel,
      });
      setTranscript(transcriptResult);

      setStage("generating");
      try {
        const notesResult = await generateNotesForTranscript({
          transcript: transcriptResult,
          notesModel,
          originalName: result.originalName,
        });
        setNotes(notesResult.notes);
        setMarkdown(notesResult.markdown);
      } catch (error) {
        setNotesError({
          message: getErrorMessage(
            error,
            "Không thể tạo meeting notes. Vui lòng thử lại.",
          ),
          code: getErrorCode(error),
        });
      }

      setStage("done");
    } catch (error) {
      setStage("idle");
      setAppError({
        message: getErrorMessage(error, "Xử lý thất bại. Vui lòng thử lại."),
        code: getErrorCode(error),
      });
    }
  }

  async function handleCopyMarkdown() {
    if (!markdown) {
      return;
    }

    try {
      await copyTextToClipboard(markdown);
      setCopied(true);
      setExportError(null);
    } catch (error) {
      setCopied(false);
      setExportError({
        message: getErrorMessage(
          error,
          "Không thể copy Markdown. Vui lòng chọn nội dung trong Markdown preview để copy thủ công.",
        ),
      });
    }
  }

  async function handleCopyFollowUp() {
    if (!followUpBrief) {
      return;
    }

    try {
      await copyTextToClipboard(followUpBrief);
      setCopiedFollowUp(true);
      setExportError(null);
    } catch (error) {
      setCopiedFollowUp(false);
      setExportError({
        message: getErrorMessage(
          error,
          "Không thể copy Follow-up Brief. Vui lòng chọn nội dung để copy thủ công.",
        ),
      });
    }
  }

  function handleDownloadMarkdown() {
    if (!markdown || !notes) {
      return;
    }

    const exportResult = exportMeetingNotesMarkdown(notes);
    const blob = new Blob([String(exportResult.content)], {
      type: exportResult.mimeType,
    });
    downloadBlob(blob, exportResult.filename);
  }

  async function handleDownloadDocx() {
    if (!notes || isExportingDocx) {
      return;
    }

    try {
      setExportError(null);
      setIsExportingDocx(true);

      const response = await fetch("/api/export-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "docx",
          notes,
        }),
      });

      if (!response.ok) {
        const error = await readApiError(
          response,
          "Không thể xuất DOCX. Vui lòng thử lại.",
        );
        throw error;
      }

      const blob = await response.blob();
      const filename = getFilenameFromDisposition(
        response.headers.get("Content-Disposition"),
      );
      downloadBlob(blob, filename);
    } catch (error) {
      const code = getErrorCode(error);
      if (code === "PLAN_FEATURE_UNAVAILABLE") {
        setShowDocxUpsell(true);
        return;
      }
      setExportError({
        message: getErrorMessage(
          error,
          "Không thể xuất DOCX. Vui lòng thử lại.",
        ),
        code,
      });
    } finally {
      setIsExportingDocx(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-5xl rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-blue-700">
                Vietnamese AI workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl">
                Meeting Notes Generator for Vietnamese
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Upload an audio or video file to generate Vietnamese meeting
                notes with speaker labels, timestamps, summaries, decisions,
                and action items.
              </p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Local upload mode
            </div>
          </div>
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-8 lg:px-10">
          <section aria-labelledby="upload-title" className="space-y-4">
            <div>
              <h2 id="upload-title" className="text-lg font-semibold">
                Audio or video file
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose a Vietnamese meeting recording to preview the note
                generation flow.
              </p>
            </div>

            <label
              className={[
                "block cursor-pointer rounded-lg border border-dashed p-5 transition",
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
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
                  <span className="block text-base font-semibold text-slate-950">
                    Drag and drop your recording here
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    or use the file picker to select MP3, MP4, WAV, or M4A.
                  </span>
                  <span className="mt-3 block max-w-full truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </span>
                </span>
                <span className="inline-flex h-11 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">
                  Choose File
                </span>
              </span>
            </label>

            {appError ? (
              <ErrorAlert
                title="Không thể xử lý file"
                message={appError.message}
                code={appError.code}
              />
            ) : null}

            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <p>
                <span className="font-semibold text-slate-950">
                  Maximum file size:
                </span>{" "}
                1GB
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  Supported formats:
                </span>{" "}
                MP3, MP4, WAV, M4A
              </p>
              <p>Large files will be uploaded in chunks automatically.</p>
            </div>
          </section>

          <section aria-labelledby="model-title" className="space-y-4">
            <h2 id="model-title" className="text-lg font-semibold">
              Models
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <ModelSelect
                id="transcription-model"
                label="Transcription Model"
                helperText="Model for audio transcription"
                value={transcriptionModel}
                onChange={setTranscriptionModel}
              />
              <ModelSelect
                id="notes-model"
                label="Notes Generation Model"
                helperText="Model for generating meeting notes"
                value={notesModel}
                onChange={setNotesModel}
              />
            </div>
          </section>

          <section aria-label="Generation controls" className="space-y-4">
            <button
              type="button"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-blue-700 px-5 text-base font-semibold text-white shadow-sm transition enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:w-auto"
              disabled={!canGenerate}
              onClick={handleGenerate}
            >
              {getButtonText(stage)}
            </button>

            {stage !== "idle" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div aria-live="polite">
                    <p className="text-base font-semibold text-slate-950">
                      {stage === "uploading"
                        ? `Uploading... ${uploadProgress}% (${uploadedChunks}/${totalChunks || 1} chunks)`
                        : stage === "transcribing"
                          ? "Transcribing..."
                          : stage === "generating"
                            ? "Generating notes..."
                          : statusSteps.find((step) => step.id === stage)?.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {stage === "transcribing"
                        ? "Calling Gemini for Vietnamese transcription with timestamps and speaker labels."
                        : stage === "generating"
                          ? "Creating professional Vietnamese meeting notes and Markdown."
                          : "Chunks are uploaded locally before Gemini processing."}
                    </p>
                  </div>
                  <ol className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    {statusSteps.map((step) => (
                      <li
                        key={step.id}
                        className={[
                          "rounded-md border px-3 py-2 font-medium",
                          getStepState(stage, step.id) === "active"
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : getStepState(stage, step.id) === "complete"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-500",
                        ].join(" ")}
                      >
                        {step.label}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-700 transition-all"
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
            ) : null}
          </section>

          {showResults ? (
            <section
              aria-labelledby="result-title"
              className="border-t border-slate-200 pt-8"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-emerald-700">
                    Done
                  </p>
                  <h2 id="result-title" className="mt-1 text-2xl font-semibold">
                    {notes ? "Meeting notes generated" : "Transcription completed"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {notes
                      ? "Markdown is ready to copy or download."
                      : "Transcript is available. Notes generation did not complete."}
                  </p>
                </div>
                <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-3 xl:w-auto">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition enabled:hover:border-blue-300 enabled:hover:text-blue-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={!canExportMarkdown}
                    onClick={handleCopyMarkdown}
                  >
                    {copied ? "Copied" : "Copy Markdown"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    disabled={!canExportMarkdown}
                    onClick={handleDownloadMarkdown}
                  >
                    Download .md
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition enabled:hover:border-blue-300 enabled:hover:text-blue-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={!canExportDocx}
                    onClick={handleDownloadDocx}
                  >
                    {isExportingDocx ? "Exporting..." : "Download .docx"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-3 text-sm font-semibold text-white transition enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    disabled={!followUpBrief}
                    onClick={handleCopyFollowUp}
                  >
                    {copiedFollowUp ? "Follow-up copied" : "Copy Follow-up"}
                  </button>
                  </div>
                </div>
              </div>

              {exportError ? (
                <ErrorAlert
                  className="mt-6"
                  title="Không thể xuất DOCX"
                  message={exportError.message}
                  code={exportError.code}
                />
              ) : null}

              {notesError ? (
                <ErrorAlert
                  tone="warning"
                  className="mt-6"
                  title="Không thể tạo meeting notes"
                  message={notesError.message}
                  code={notesError.code}
                />
              ) : null}

              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-lg font-semibold text-emerald-950">
                  File is ready for transcription
                </h3>
                <dl className="mt-4 grid gap-3 text-sm text-emerald-900 lg:grid-cols-2">
                  <ResultMeta label="Upload ID" value={uploadResult.uploadId} />
                  <ResultMeta
                    label="Original name"
                    value={uploadResult.originalName}
                  />
                  <ResultMeta
                    label="Stored path"
                    value={uploadResult.storedPath}
                  />
                  <ResultMeta
                    label="Size"
                    value={formatBytes(uploadResult.sizeBytes)}
                  />
                  <ResultMeta
                    label="Chunks"
                    value={String(uploadResult.totalChunks)}
                  />
                </dl>
              </div>

              {notes ? (
                <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">
                      Tóm tắt điều hành
                    </h3>
                    <BulletList items={notes.executiveSummary} />
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">
                      Thông tin cuộc họp
                    </h3>
                    <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <ResultMeta
                        label="Ngôn ngữ"
                        value={notes.meetingOverview.language}
                      />
                      <ResultMeta
                        label="Thời lượng"
                        value={notes.meetingOverview.duration}
                      />
                      <ResultMeta
                        label="Số người nói"
                        value={String(notes.meetingOverview.speakerCount)}
                      />
                      <ResultMeta
                        label="Chủ đề chính"
                        value={notes.meetingOverview.mainTopic}
                      />
                    </dl>
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">Nội dung chính</h3>
                    <div className="mt-4 space-y-4">
                      {notes.keyDiscussionPoints.map((point) => (
                        <section key={point.title}>
                          <h4 className="font-semibold text-slate-900">
                            {point.title}
                          </h4>
                          <BulletList items={point.details} />
                        </section>
                      ))}
                    </div>
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">Quyết định</h3>
                    <BulletList items={notes.decisions} />
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">Action Items</h3>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="py-2 pr-3 font-semibold">
                              Việc cần làm
                            </th>
                            <th className="py-2 pr-3 font-semibold">
                              Người phụ trách
                            </th>
                            <th className="py-2 pr-3 font-semibold">
                              Deadline
                            </th>
                            <th className="py-2 pr-3 font-semibold">Ưu tiên</th>
                            <th className="py-2 pr-3 font-semibold">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notes.actionItems.map((item) => (
                            <tr
                              key={`${item.task}-${item.owner}-${item.deadline}`}
                              className="border-b border-slate-100"
                            >
                              <td className="py-3 pr-3">{item.task}</td>
                              <td className="py-3 pr-3">{item.owner}</td>
                              <td className="py-3 pr-3">{item.deadline}</td>
                              <td className="py-3 pr-3">{item.priority}</td>
                              <td className="py-3 pr-3">{item.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                  <article className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Follow-up Brief
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Copy nhanh để gửi team sau cuộc họp. Pro lưu và theo
                          dõi các action items này trong Action Board.
                        </p>
                      </div>
                      <a
                        href="/actions"
                        className="inline-flex h-10 items-center justify-center rounded-md border border-blue-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Xem Action Board
                      </a>
                    </div>
                    <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-blue-950 p-4 text-xs leading-6 text-blue-50">
                      {followUpBrief}
                    </pre>
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">
                      Rủi ro / Blockers
                    </h3>
                    <BulletList items={notes.risksAndBlockers} />
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">Câu hỏi còn mở</h3>
                    <BulletList items={notes.openQuestions} />
                  </article>
                  <article className="p-5">
                    <h3 className="text-lg font-semibold">Markdown preview</h3>
                    <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                      {markdown}
                    </pre>
                  </article>
                </div>
              ) : null}

              <div className="mt-6 rounded-lg border border-slate-200">
                <article className="p-5">
                  <h3 className="text-lg font-semibold">Transcript preview</h3>
                  <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <ResultMeta
                      label="Duration"
                      value={transcript.duration || "Chưa xác định"}
                    />
                    <ResultMeta
                      label="Speakers"
                      value={transcript.speakers.join(", ")}
                    />
                  </dl>
                  <div className="mt-5 space-y-3">
                    {transcript.segments.map((line, index) => (
                      <p
                        key={`${line.start}-${line.speaker}-${index}`}
                        className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                      >
                        <span className="font-semibold text-slate-950">
                          [{line.start}
                          {line.end ? ` - ${line.end}` : ""}] {line.speaker}:
                        </span>{" "}
                        {line.text}
                      </p>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="empty-result-title"
              className="border-t border-slate-200 pt-8"
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase text-slate-500">
                    Waiting for recording
                  </p>
                  <h2
                    id="empty-result-title"
                    className="mt-1 text-xl font-semibold text-slate-950"
                  >
                    Kết quả sẽ hiển thị tại đây
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Chọn file MP3, MP4, WAV hoặc M4A rồi bấm Generate Meeting
                    Notes. App sẽ upload theo chunk, transcribe bằng Gemini, sau
                    đó tạo notes và Markdown.
                  </p>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
                    <p className="font-semibold text-slate-900">1. Upload</p>
                    <p className="mt-1 leading-5">Tải file theo chunk an toàn.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
                    <p className="font-semibold text-slate-900">2. Transcribe</p>
                    <p className="mt-1 leading-5">Tạo transcript có speaker và timestamp.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
                    <p className="font-semibold text-slate-900">3. Export</p>
                    <p className="mt-1 leading-5">Copy Markdown, tải `.md` hoặc `.docx`.</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
      {showDocxUpsell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-950">Download DOCX</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tính năng này chỉ có trên plan <strong>Pro</strong>. Nâng cấp để tải .docx và
              lưu lịch sử cuộc họp không giới hạn.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="/pricing"
                className="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Xem plans Pro
              </a>
              <button
                type="button"
                onClick={() => setShowDocxUpsell(false)}
                className="flex-1 h-10 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ErrorAlert({
  title,
  message,
  code,
  tone = "error",
  className = "",
}: {
  title: string;
  message: string;
  code?: string;
  tone?: "error" | "warning";
  className?: string;
}) {
  const classes =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`rounded-lg border p-4 ${classes} ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
      {code ? (
        <p className="mt-2 text-xs font-medium opacity-75">Code: {code}</p>
      ) : null}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-slate-700">
      {items.length > 0 ? (
        items.map((item) => (
          <li key={item} className="flex gap-2 leading-7">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-700" />
            <span>{item}</span>
          </li>
        ))
      ) : (
        <li className="leading-7">Chưa xác định</li>
      )}
    </ul>
  );
}

function ResultMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 break-words rounded-md bg-white/70 px-3 py-2">
        {value}
      </dd>
    </div>
  );
}

function getButtonText(stage: ProcessStage) {
  if (stage === "uploading") {
    return "Uploading...";
  }

  if (stage === "transcribing") {
    return "Transcribing...";
  }

  if (stage === "generating") {
    return "Generating notes...";
  }

  return "Generate Meeting Notes";
}

function getClientFileErrorCode(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = [".mp3", ".mp4", ".wav", ".m4a"].some(
    (extension) => lowerName.endsWith(extension),
  );

  if (!hasSupportedExtension) {
    return "INVALID_FILE_TYPE";
  }

  if (file.size > 1024 * 1024 * 1024) {
    return "FILE_TOO_LARGE";
  }

  return undefined;
}

function getFilenameFromDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] || "meeting-notes.docx";
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some in-app browsers deny Clipboard API even on localhost.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ModelSelect({
  id,
  label,
  helperText,
  value,
  onChange,
}: {
  id: string;
  label: string;
  helperText: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="mt-2 h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {modelOptions.map((model) => (
          <option key={model.value} value={model.value}>
            {model.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm text-slate-600">{helperText}</p>
    </div>
  );
}

function getStepState(current: ProcessStage, step: ProcessStage) {
  const currentIndex = statusSteps.findIndex((item) => item.id === current);
  const stepIndex = statusSteps.findIndex((item) => item.id === step);

  if (currentIndex === stepIndex) {
    return "active";
  }

  if (currentIndex > stepIndex) {
    return "complete";
  }

  return "pending";
}
