import {
  exportMeetingNotes,
  type ExportFormat,
} from "@/lib/exporters/meeting-notes-exporter";
import type { VietnameseMeetingNotes } from "@/lib/gemini";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getSession } from "@/lib/session";
import { canExportDocx } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let format: string | undefined;

  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để sử dụng tính năng này.", 401);
    }

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    format = normalizeString(payload.format) || undefined;
    const notes = payload.notes;

    if (format !== "markdown" && format !== "docx") {
      throw appApiError(
        "INVALID_EXPORT_FORMAT",
        "Định dạng export không hợp lệ.",
        400,
        `Invalid export format: ${String(format)}`,
      );
    }

    if (format === "docx" && !canExportDocx(user)) {
      throw appApiError(
        "PLAN_FEATURE_UNAVAILABLE",
        "Download DOCX chỉ có trên plan Pro. Nâng cấp để sử dụng tính năng này.",
        403,
      );
    }

    if (!isNotesData(notes)) {
      throw appApiError(
        "INVALID_NOTES_DATA",
        "Dữ liệu meeting notes không hợp lệ.",
        400,
      );
    }

    const result = await exportMeetingNotes(
      notes as VietnameseMeetingNotes,
      format as ExportFormat,
    );

    if (result.format === "docx") {
      const buffer = Buffer.isBuffer(result.content)
        ? result.content
        : Buffer.from(String(result.content));

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
        },
      });
    }

    return Response.json({
      ok: true,
      filename: result.filename,
      mimeType: result.mimeType,
      content: String(result.content),
      format: result.format,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/export-notes",
      fallbackCode: format === "docx" ? "DOCX_EXPORT_FAILED" : "INTERNAL_ERROR",
      fallbackMessage:
        format === "docx"
          ? "Không thể xuất DOCX. Vui lòng thử lại."
          : "Không thể export meeting notes. Vui lòng thử lại.",
    });
  }
}

function isNotesData(value: unknown) {
  return isRecord(value) && isRecord(value.meetingOverview);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
