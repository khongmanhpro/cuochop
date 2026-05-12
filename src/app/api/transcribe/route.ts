import { transcribeVietnameseMeeting } from "@/lib/gemini";
import { getGeminiModelId } from "@/lib/models";
import {
  cleanupOldUploadsSafely,
  parseRequiredString,
  validateStoredUploadPath,
} from "@/lib/upload-server";
import { createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadId: string | undefined;

  try {
    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    uploadId = parseRequiredString(
      normalizeString(payload.uploadId),
      "uploadId",
    );
    const originalName = parseRequiredString(
      normalizeString(payload.originalName),
      "originalName",
    );
    const storedPath = parseRequiredString(
      normalizeString(payload.storedPath),
      "storedPath",
    );
    const transcriptionModel = parseRequiredString(
      normalizeString(payload.transcriptionModel),
      "transcriptionModel",
    );

    getGeminiModelId(transcriptionModel);

    const filePath = await validateStoredUploadPath({
      uploadId,
      originalName,
      storedPath,
    }).catch((error) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error("Uploaded file does not exist.");
      }

      throw error;
    });

    const transcript = await transcribeVietnameseMeeting({
      filePath,
      originalName,
      modelLabel: transcriptionModel,
    });

    await cleanupOldUploadsSafely({ route: "/api/transcribe", uploadId });

    return Response.json({
      ok: true,
      transcript,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/transcribe",
      uploadId,
      fallbackCode: "TRANSCRIPTION_FAILED",
      fallbackMessage: "Transcription thất bại. Vui lòng thử lại.",
    });
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
