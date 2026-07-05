import {
  cleanupOldUploadsSafely,
  mergeChunksToFinalFile,
  parseRequiredString,
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
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để hoàn tất upload.", 401);
    }
    userId = user.id;

    await cleanupOldUploadsSafely({ route: "/api/complete-upload" });

    const body: unknown = await request.json();
    const payload = body instanceof Object ? (body as Record<string, unknown>) : {};
    uploadId = parseRequiredString(
      normalizeString(payload.uploadId),
      "uploadId",
    );
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
    if (upload.status === "completed") {
      return Response.json({
        ok: true,
        uploadId: upload.id,
        originalName: upload.originalName,
        storedPath: upload.storedPath,
        sizeBytes: upload.sizeBytes,
        totalChunks: upload.totalChunks,
      });
    }

    const result = await mergeChunksToFinalFile({
      uploadId,
      originalName: upload.originalName,
      totalChunks: upload.totalChunks,
    });
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        status: "completed",
        storedPath: result.storedPath,
        sizeBytes: result.sizeBytes,
        uploadedChunks: result.totalChunks,
        errorCode: null,
        errorMessage: null,
      },
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (uploadId && userId) {
      await prisma.upload.updateMany({
        where: { id: uploadId, userId },
        data: {
          status: "failed",
          errorCode:
            error instanceof Error && "code" in error
              ? String(error.code)
              : "COMPLETE_UPLOAD_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Complete upload failed.",
        },
      });
    }
    return createApiErrorResponse(error, {
      route: "/api/complete-upload",
      uploadId,
      fallbackCode: "COMPLETE_UPLOAD_FAILED",
      fallbackMessage: "Hoàn tất upload thất bại. Vui lòng thử lại.",
    });
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}
