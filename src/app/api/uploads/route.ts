import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  cleanupOldUploadsSafely,
  createUploadId,
  parseRequiredInteger,
  parseRequiredString,
  validateMediaFilename,
} from "@/lib/upload-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để upload file.", 401);
    }

    await cleanupOldUploadsSafely({ route: "/api/uploads" });

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const originalName = parseRequiredString(
      normalizeString(payload.originalName),
      "originalName",
    );
    const totalChunks = parseRequiredInteger(
      normalizeString(payload.totalChunks),
      "totalChunks",
    );

    const validation = validateMediaFilename(originalName);
    if (!validation.ok) {
      throw appApiError(
        "INVALID_FILE_TYPE",
        "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
        400,
        validation.error,
      );
    }

    const upload = await prisma.upload.create({
      data: {
        id: createUploadId(),
        userId: user.id,
        originalName,
        totalChunks,
        status: "pending",
      },
    });

    return Response.json({
      ok: true,
      uploadId: upload.id,
      originalName: upload.originalName,
      totalChunks: upload.totalChunks,
      uploadedChunks: upload.uploadedChunks,
      status: upload.status,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/uploads",
      fallbackCode: "CHUNK_UPLOAD_FAILED",
      fallbackMessage: "Không thể bắt đầu upload. Vui lòng thử lại.",
    });
  }
}

function normalizeString(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
