import { transcribeVietnameseMeeting } from "@/lib/gemini";
import { getGeminiModelId } from "@/lib/models";
import {
  cleanupOldUploadsSafely,
  parseRequiredString,
  validateStoredUploadPath,
} from "@/lib/upload-server";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadId: string | undefined;
  let userId: string | undefined;

  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để transcribe file.", 401);
    }
    userId = user.id;

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    uploadId = parseRequiredString(
      normalizeString(payload.uploadId),
      "uploadId",
    );
    const transcriptionModel = parseRequiredString(
      normalizeString(payload.transcriptionModel),
      "transcriptionModel",
    );

    getGeminiModelId(transcriptionModel);

    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, userId: user.id },
    });
    if (
      !upload ||
      (upload.status !== "completed" && upload.status !== "failed") ||
      !upload.storedPath
    ) {
      throw appApiError(
        "INVALID_UPLOAD_PATH",
        "File upload chưa sẵn sàng để transcribe.",
        400,
        "Upload is missing, incomplete, or not owned by the current user.",
      );
    }

    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "transcribing", errorCode: null, errorMessage: null },
    });

    const filePath = await validateStoredUploadPath({
      uploadId,
      originalName: upload.originalName,
      storedPath: upload.storedPath,
    }).catch((error) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error("Uploaded file does not exist.");
      }

      throw error;
    });

    const transcript = await transcribeVietnameseMeeting({
      filePath,
      originalName: upload.originalName,
      modelLabel: transcriptionModel,
    });

    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "completed", errorCode: null, errorMessage: null },
    });

    await cleanupOldUploadsSafely({ route: "/api/transcribe", uploadId });

    return Response.json({
      ok: true,
      transcript,
    });
  } catch (error) {
    if (uploadId && userId) {
      await prisma.upload.updateMany({
        where: { id: uploadId, userId },
        data: {
          status: "failed",
          errorCode: error instanceof Error && "code" in error ? String(error.code) : "TRANSCRIPTION_FAILED",
          errorMessage: error instanceof Error ? error.message : "Transcription failed.",
        },
      });
    }
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
