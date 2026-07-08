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
    <main className="min-h-screen bg-surface px-4 py-8 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-5xl rounded-xl border border-hairline bg-canvas shadow-sm">
        <div className="border-b border-hairline px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-brand-coral">
                Vietnamese AI workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
                Meeting Notes Generator for Vietnamese
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate sm:text-lg">
                Upload an audio or video file to generate Vietnamese meeting
                notes with speaker labels, timestamps, summaries, decisions,
                and action items.
              </p>
            </div>
            <div className="badge-success">
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
              <p className="mt-1 text-sm text-slate">
                Choose a Vietnamese meeting recording to preview the note
                generation flow.
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
          ) : (
            <EmptyResultState />
          )}
        </div>
      </section>
    </main>
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
            Waiting for recording
          </p>
          <h2
            id="empty-result-title"
            className="mt-1 text-xl font-semibold text-ink"
          >
            Kết quả sẽ hiển thị tại đây
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">
            Chọn file MP3, MP4, WAV hoặc M4A rồi bấm Generate Meeting
            Notes. App sẽ upload theo chunk, transcribe bằng Gemini, sau
            đó tạo notes và Markdown.
          </p>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate sm:grid-cols-3">
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">1. Upload</p>
            <p className="mt-1 leading-5">Tải file theo chunk an toàn.</p>
          </div>
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">2. Transcribe</p>
            <p className="mt-1 leading-5">Tạo transcript có speaker và timestamp.</p>
          </div>
          <div className="rounded-md border border-hairline bg-canvas px-3 py-3">
            <p className="font-semibold text-ink">3. Export</p>
            <p className="mt-1 leading-5">Copy Markdown, tải `.md` hoặc `.docx`.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
