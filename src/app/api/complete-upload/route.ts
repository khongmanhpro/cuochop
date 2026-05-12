import {
  cleanupOldUploadsSafely,
  mergeChunksToFinalFile,
  parseRequiredInteger,
  parseRequiredString,
} from "@/lib/upload-server";
import { createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadId: string | undefined;

  try {
    await cleanupOldUploadsSafely({ route: "/api/complete-upload" });

    const body: unknown = await request.json();
    const payload = body instanceof Object ? (body as Record<string, unknown>) : {};
    uploadId = parseRequiredString(
      normalizeString(payload.uploadId),
      "uploadId",
    );
    const originalName = parseRequiredString(
      normalizeString(payload.originalName),
      "originalName",
    );
    const totalChunks = parseRequiredInteger(
      normalizeString(payload.totalChunks),
      "totalChunks",
    );

    const result = await mergeChunksToFinalFile({
      uploadId,
      originalName,
      totalChunks,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/complete-upload",
      uploadId,
      fallbackCode: "COMPLETE_UPLOAD_FAILED",
      fallbackMessage: "Hoàn tất upload thất bại. Vui lòng thử lại.",
    });
  }
}

function normalizeString(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" ? value : null;
}
