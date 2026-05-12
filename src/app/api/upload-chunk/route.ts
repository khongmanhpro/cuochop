import {
  cleanupOldUploadsSafely,
  parseRequiredInteger,
  parseRequiredString,
  saveChunk,
  validateMediaFilename,
} from "@/lib/upload-server";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadId: string | undefined;

  try {
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

    await saveChunk({
      uploadId,
      chunkIndex,
      chunk,
    });

    return Response.json({
      ok: true,
      uploadId,
      chunkIndex,
      totalChunks,
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
