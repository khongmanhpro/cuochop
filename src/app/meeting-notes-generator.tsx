"use client";

import { defaultModel } from "@/lib/meeting-notes-mock";
import {
  getButtonText,
  useMeetingNotesPipeline,
} from "@/lib/use-meeting-notes-pipeline";
import { FileUploadDropzone } from "@/components/file-upload-dropzone";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { MeetingTemplateSelect } from "@/components/meeting-template-select";
import {
  ErrorAlert,
  MeetingNotesResult,
} from "@/components/meeting-notes-result";
import { ActionTriagePanel } from "@/components/action-triage-panel";

export function MeetingNotesGenerator() {
  const pipeline = useMeetingNotesPipeline(defaultModel);
  const {
    selectedFile,
    transcriptionModel,
    notesModel,
    template,
    stage,
    uploadProgress,
    uploadedChunks,
    totalChunks,
    uploadResult,
    transcript,
    notes,
    markdown,
    meetingNoteId,
    generatedActionItems,
    isDragging,
    copied,
    copiedFollowUp,
    appError,
    notesError,
    exportError,
    isExportingDocx,
    chooseFile,
    setTranscriptionModel,
    setNotesModel,
    setTemplate,
    setIsDragging,
    handleGenerate,
    handleCopyMarkdown,
    handleCopyFollowUp,
    handleDownloadMarkdown,
    handleDownloadDocx,
  } = pipeline;

  const isProcessing =
    stage === "uploading" ||
    stage === "transcribing" ||
    stage === "generating";
  const canGenerate = Boolean(selectedFile) && !isProcessing;
  const showResults = stage === "done" && uploadResult && transcript;

  return (
    <div className="embedded-panel text-ink">
      <section className="card-surface overflow-hidden">
        <div className="border-b border-hairline-soft px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="page-eyebrow">Tạo notes</p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.3px] text-ink sm:text-[24px]">
                Ghi chú cuộc họp từ file ghi âm
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-[1.55] text-slate">
                Upload MP3/MP4/WAV/M4A — hệ thống phiên âm, tóm tắt, tách quyết
                định và action items.
              </p>
            </div>
            <span className="badge-success shrink-0 self-start">
              Upload local
            </span>
          </div>
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-6">
          <section aria-labelledby="upload-title" className="space-y-4">
            <div>
              <h2 id="upload-title" className="text-lg font-semibold">
                File âm thanh / video
              </h2>
              <p className="mt-1 text-sm text-slate">
                Chọn bản ghi cuộc họp tiếng Việt để tạo notes và action items.
              </p>
            </div>

            <FileUploadDropzone
              selectedFile={selectedFile}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              chooseFile={chooseFile}
            />

            {appError ? (
              <ErrorAlert
                title="Không thể xử lý file"
                message={appError.message}
                code={appError.code}
              />
            ) : null}

            <div className="grid gap-2 text-sm text-slate sm:grid-cols-3">
              <p>
                <span className="font-semibold text-ink">
                  Maximum file size:
                </span>{" "}
                1GB
              </p>
              <p>
                <span className="font-semibold text-ink">
                  Supported formats:
                </span>{" "}
                MP3, MP4, WAV, M4A
              </p>
              <p>Large files will be uploaded in chunks automatically.</p>
            </div>
          </section>

          <MeetingTemplateSelect
            template={template}
            setTemplate={setTemplate}
            transcriptionModel={transcriptionModel}
            setTranscriptionModel={setTranscriptionModel}
            notesModel={notesModel}
            setNotesModel={setNotesModel}
          />

          <section aria-label="Generation controls" className="space-y-4">
            <button
              type="button"
              className="button-primary h-12 w-full px-5 text-base sm:w-auto"
              disabled={!canGenerate}
              onClick={handleGenerate}
            >
              {getButtonText(stage)}
            </button>

            <UploadProgressBar
              stage={stage}
              uploadProgress={uploadProgress}
              uploadedChunks={uploadedChunks}
              totalChunks={totalChunks}
            />
          </section>

          {showResults ? (
            <>
              <MeetingNotesResult
                uploadResult={uploadResult!}
                transcript={transcript!}
                notes={notes}
                markdown={markdown}
                copied={copied}
                copiedFollowUp={copiedFollowUp}
                exportError={exportError}
                notesError={notesError}
                isExportingDocx={isExportingDocx}
                onCopyMarkdown={handleCopyMarkdown}
                onCopyFollowUp={handleCopyFollowUp}
                onDownloadMarkdown={handleDownloadMarkdown}
                onDownloadDocx={handleDownloadDocx}
              />
              {meetingNoteId && generatedActionItems.length > 0 ? (
                <ActionTriagePanel
                  meetingNoteId={meetingNoteId}
                  initialItems={generatedActionItems}
                />
              ) : null}
            </>
          ) : (
            <EmptyResultState />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyResultState() {
  return (
    <section
      aria-labelledby="empty-result-title"
      className="border-t border-hairline pt-8"
    >
      <div className="rounded-lg border border-hairline bg-surface p-5">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-slate">
            Chưa có file
          </p>
          <h2
            id="empty-result-title"
            className="mt-1 text-xl font-semibold text-ink"
          >
            Kết quả sẽ hiển thị tại đây
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">
            Chọn file MP3, MP4, WAV hoặc M4A rồi bấm &quot;Tạo meeting notes&quot;.
            App upload theo chunk, phiên âm bằng Gemini, rồi tạo notes.
          </p>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate sm:grid-cols-3">
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">1. Tải lên</p>
            <p className="mt-1 leading-5">Upload file theo chunk an toàn.</p>
          </div>
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">2. Phiên âm</p>
            <p className="mt-1 leading-5">Transcript có speaker và timestamp.</p>
          </div>
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">3. Xuất</p>
            <p className="mt-1 leading-5">Copy Markdown, tải .md hoặc .docx.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
