"use client";

import { useCallback, useState } from "react";
import { getErrorCode, getErrorMessage, readApiError } from "@/lib/api-client";
import { exportMeetingNotesMarkdown } from "@/lib/exporters/markdown-exporter";
import { formatFollowUpBrief } from "@/lib/follow-up-brief";
import type {
  VietnameseMeetingNotes,
  VietnameseMeetingTranscript,
} from "@/lib/gemini";
import {
  generateNotesForTranscript,
  type GeneratedActionItemRef,
} from "@/lib/notes-client";
import { transcribeUploadedFile } from "@/lib/transcribe-client";
import {
  type CompleteUploadResponse,
  uploadFileInChunks,
  validateClientFile,
} from "@/lib/upload-client";

export type ProcessStage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "generating"
  | "done";

export type ErrorState = {
  message: string;
  code?: string;
};

export const statusSteps: Array<{ id: ProcessStage; label: string }> = [
  { id: "uploading", label: "Đang tải lên" },
  { id: "transcribing", label: "Đang phiên âm" },
  { id: "generating", label: "Đang tạo notes" },
  { id: "done", label: "Xong" },
];

export const allowedExtensions = ".mp3,.mp4,.wav,.m4a";

export function getClientFileErrorCode(file: File) {
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

export function getButtonText(stage: ProcessStage) {
  if (stage === "uploading") {
    return "Đang tải lên…";
  }

  if (stage === "transcribing") {
    return "Đang phiên âm…";
  }

  if (stage === "generating") {
    return "Đang tạo notes…";
  }

  return "Tạo meeting notes";
}

export function getStepState(current: ProcessStage, step: ProcessStage) {
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

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getFilenameFromDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] || "meeting-notes.docx";
}

export async function copyTextToClipboard(text: string) {
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

export function downloadBlob(blob: Blob, filename: string) {
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

export type PipelineState = {
  selectedFile: File | null;
  transcriptionModel: string;
  notesModel: string;
  template: string;
  stage: ProcessStage;
  uploadProgress: number;
  uploadedChunks: number;
  totalChunks: number;
  uploadResult: CompleteUploadResponse | null;
  transcript: VietnameseMeetingTranscript | null;
  notes: VietnameseMeetingNotes | null;
  markdown: string;
  meetingNoteId: string | null;
  generatedActionItems: GeneratedActionItemRef[];
  isDragging: boolean;
  copied: boolean;
  copiedFollowUp: boolean;
  appError: ErrorState | null;
  notesError: ErrorState | null;
  exportError: ErrorState | null;
  isExportingDocx: boolean;
};

export type PipelineActions = {
  chooseFile: (file: File | undefined) => void;
  setTranscriptionModel: (value: string) => void;
  setNotesModel: (value: string) => void;
  setTemplate: (value: string) => void;
  setIsDragging: (value: boolean) => void;
  handleGenerate: () => Promise<void>;
  handleCopyMarkdown: () => Promise<void>;
  handleCopyFollowUp: () => Promise<void>;
  handleDownloadMarkdown: () => void;
  handleDownloadDocx: () => Promise<void>;
};

export type MeetingNotesPipeline = PipelineState &
  Omit<PipelineActions, "setTranscriptionModel" | "setNotesModel" | "setTemplate" | "setIsDragging"> & {
    setTranscriptionModel: (value: string) => void;
    setNotesModel: (value: string) => void;
    setTemplate: (value: string) => void;
    setIsDragging: (value: boolean) => void;
  };

export function useMeetingNotesPipeline(
  defaultModel: string,
): MeetingNotesPipeline {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionModel, setTranscriptionModel] = useState(defaultModel);
  const [notesModel, setNotesModel] = useState(defaultModel);
  const [template, setTemplate] = useState("default");
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
  const [meetingNoteId, setMeetingNoteId] = useState<string | null>(null);
  const [generatedActionItems, setGeneratedActionItems] = useState<
    GeneratedActionItemRef[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [appError, setAppError] = useState<ErrorState | null>(null);
  const [notesError, setNotesError] = useState<ErrorState | null>(null);
  const [exportError, setExportError] = useState<ErrorState | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const resetResultState = useCallback(() => {
    setUploadResult(null);
    setTranscript(null);
    setNotes(null);
    setMarkdown("");
    setMeetingNoteId(null);
    setGeneratedActionItems([]);
    setNotesError(null);
    setExportError(null);
    setIsExportingDocx(false);
    setCopied(false);
    setCopiedFollowUp(false);
  }, []);

  const chooseFile = useCallback(
    (file: File | undefined) => {
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
        resetResultState();
        return;
      }

      setSelectedFile(file);
      setAppError(null);
      setStage("idle");
      setUploadProgress(0);
      setUploadedChunks(0);
      setTotalChunks(0);
      resetResultState();
    },
    [resetResultState],
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) {
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
      resetResultState();
      setAppError(null);
      setStage("uploading");
      setUploadProgress(0);
      setUploadedChunks(0);
      setTotalChunks(Math.max(1, Math.ceil(selectedFile.size / (10 * 1024 * 1024))));

      const result = await uploadFileInChunks({
        file: selectedFile,
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
          template,
        });
        setNotes(notesResult.notes);
        setMarkdown(notesResult.markdown);
        setMeetingNoteId(notesResult.meetingNoteId ?? null);
        setGeneratedActionItems(notesResult.actionItems ?? []);
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
  }, [selectedFile, transcriptionModel, notesModel, template, resetResultState]);

  const handleCopyMarkdown = useCallback(async () => {
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
  }, [markdown]);

  const followUpBrief = notes ? formatFollowUpBrief(notes) : "";

  const handleCopyFollowUp = useCallback(async () => {
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
  }, [followUpBrief]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!markdown || !notes) {
      return;
    }

    const exportResult = exportMeetingNotesMarkdown(notes);
    const blob = new Blob([String(exportResult.content)], {
      type: exportResult.mimeType,
    });
    downloadBlob(blob, exportResult.filename);
  }, [markdown, notes]);

  const handleDownloadDocx = useCallback(async () => {
    if (!notes) {
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
  }, [notes]);

  return {
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
  };
}
