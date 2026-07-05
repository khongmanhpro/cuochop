import {
  cleanupOldUploadsSafely,
  countSavedChunks,
  parseRequiredInteger,
  parseRequiredString,
  saveChunk,
  validateMediaFilename,
} from "@/lib/upload-server";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadId: string | undefined;

  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để upload file.", 401);
    }

    await cleanupOldUploadsSafely({ route: "/api/upload-chunk" });

    const formData = await request.formData();
    uploadId = parseRequiredString(formData.get("uploadId"), "uploadId");
    const originalName = parseRequiredString(
      formData.get("originalName"),
      "originalName",
    );
    const chunkIndex = parseRequiredInteger(
      formData.get("chunkIndex"),
      "chunkIndex",
    );
    const totalChunks = parseRequiredInteger(
      formData.get("totalChunks"),
      "totalChunks",
    );
    const chunk = formData.get("chunk");

    const validation = validateMediaFilename(originalName);
    if (!validation.ok) {
      throw appApiError(
        "INVALID_FILE_TYPE",
        "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
        400,
        validation.error,
      );
    }

    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw appApiError(
        "CHUNK_UPLOAD_FAILED",
        "Chunk index không hợp lệ.",
        400,
        "Invalid chunkIndex.",
      );
    }

    if (!(chunk instanceof File)) {
      throw appApiError(
        "CHUNK_UPLOAD_FAILED",
        "Không nhận được chunk file. Vui lòng thử lại.",
        400,
        "Missing file chunk.",
      );
    }

    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, userId: user.id },
    });
    if (!upload) {
      throw appApiError(
        "MISSING_UPLOAD_ID",
        "Upload ID không hợp lệ hoặc bị thiếu.",
        404,
        "Upload does not belong to the current user.",
      );
    }
    if (upload.status === "completed" || upload.status === "transcribing") {
      throw appApiError(
        "CHUNK_UPLOAD_FAILED",
        "Upload này đã hoàn tất. Vui lòng chọn lại file nếu cần upload lại.",
        409,
        `Upload status is ${upload.status}.`,
      );
    }
    if (upload.originalName !== originalName || upload.totalChunks !== totalChunks) {
      throw appApiError(
        "CHUNK_UPLOAD_FAILED",
        "Thông tin upload không khớp. Vui lòng chọn lại file.",
        400,
        "Upload metadata mismatch.",
      );
    }

    await saveChunk({
      uploadId,
      chunkIndex,
      chunk,
    });
    const uploadedChunks = await countSavedChunks({ uploadId });
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        uploadedChunks,
        status: "uploading",
        errorCode: null,
        errorMessage: null,
      },
    });

    return Response.json({
      ok: true,
      uploadId,
      chunkIndex,
      totalChunks,
      uploadedChunks,
      received: true,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/upload-chunk",
      uploadId,
      fallbackCode: "CHUNK_UPLOAD_FAILED",
      fallbackMessage: "Upload chunk thất bại. Vui lòng thử lại.",
    });
  }
}
