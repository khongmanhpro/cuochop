import { apiErrorFromBody, type ApiErrorResponseBody } from "./api-client";
import type { VietnameseMeetingNotes, VietnameseMeetingTranscript } from "./gemini";

export type GenerateNotesResponse =
  | {
      ok: true;
      notes: VietnameseMeetingNotes;
      markdown: string;
    }
  | {
      ok: false;
      error: ApiErrorResponseBody["error"];
    };

export async function generateNotesForTranscript({
  transcript,
  notesModel,
  originalName,
}: {
  transcript: VietnameseMeetingTranscript;
  notesModel: string;
  originalName?: string;
}) {
  const response = await fetch("/api/generate-notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
      notesModel,
      originalName,
    }),
  });
  const body = (await response.json()) as GenerateNotesResponse;

  if (!response.ok || !body.ok) {
    throw body.ok
      ? new Error("Tạo meeting notes thất bại.")
      : apiErrorFromBody(body, "Tạo meeting notes thất bại.");
  }

  return body;
}
