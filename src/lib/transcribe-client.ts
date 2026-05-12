import { apiErrorFromBody, type ApiErrorResponseBody } from "./api-client";
import type { VietnameseMeetingTranscript } from "./gemini";
import type { CompleteUploadResponse } from "./upload-client";

export type TranscribeResponse =
  | {
      ok: true;
      transcript: VietnameseMeetingTranscript;
    }
  | {
      ok: false;
      error: ApiErrorResponseBody["error"];
    };

export async function transcribeUploadedFile({
  upload,
  transcriptionModel,
}: {
  upload: CompleteUploadResponse;
  transcriptionModel: string;
}) {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uploadId: upload.uploadId,
      originalName: upload.originalName,
      storedPath: upload.storedPath,
      transcriptionModel,
    }),
  });
  const body = (await response.json()) as TranscribeResponse;

  if (!response.ok || !body.ok) {
    throw body.ok
      ? new Error("Transcription thất bại.")
      : apiErrorFromBody(body, "Transcription thất bại.");
  }

  return body.transcript;
}
