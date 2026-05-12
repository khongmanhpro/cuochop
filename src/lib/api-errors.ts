export const apiErrorCodes = [
  "INVALID_FILE_TYPE",
  "FILE_TOO_LARGE",
  "MISSING_UPLOAD_ID",
  "INVALID_UPLOAD_PATH",
  "FILE_NOT_FOUND",
  "MISSING_GEMINI_API_KEY",
  "INVALID_MODEL",
  "TRANSCRIPTION_FAILED",
  "NOTES_GENERATION_FAILED",
  "INVALID_TRANSCRIPT",
  "JSON_PARSE_FAILED",
  "INVALID_EXPORT_FORMAT",
  "INVALID_NOTES_DATA",
  "DOCX_EXPORT_FAILED",
  "DOCX_EXPORT_NOT_IMPLEMENTED",
  "CHUNK_UPLOAD_FAILED",
  "COMPLETE_UPLOAD_FAILED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  details?: string;
};

export class AppApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: string;

  constructor({
    code,
    message,
    status = 400,
    details,
  }: {
    code: ApiErrorCode;
    message: string;
    status?: number;
    details?: string;
  }) {
    super(message);
    this.name = "AppApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function appApiError(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: string,
) {
  return new AppApiError({ code, message, status, details });
}

export function toApiError(
  error: unknown,
  fallbackCode: ApiErrorCode,
  fallbackMessage: string,
  fallbackStatus = 400,
) {
  if (error instanceof AppApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const mapped = mapKnownErrorMessage(
    message,
    fallbackCode,
    fallbackMessage,
    fallbackStatus,
  );

  if (mapped) {
    return mapped;
  }

  return appApiError(fallbackCode, fallbackMessage, fallbackStatus, message);
}

export function createApiErrorResponse(
  error: unknown,
  {
    route,
    uploadId,
    fallbackCode,
    fallbackMessage,
    fallbackStatus = 400,
  }: {
    route: string;
    uploadId?: string;
    fallbackCode: ApiErrorCode;
    fallbackMessage: string;
    fallbackStatus?: number;
  },
) {
  const apiError = toApiError(
    error,
    fallbackCode,
    fallbackMessage,
    fallbackStatus,
  );

  logApiError(route, apiError.code, uploadId);

  const payload: ApiErrorPayload = {
    code: apiError.code,
    message: apiError.message,
  };

  if (process.env.NODE_ENV === "development" && apiError.details) {
    payload.details = apiError.details;
  }

  return Response.json(
    {
      ok: false,
      error: payload,
    },
    { status: apiError.status },
  );
}

export function logApiError(
  route: string,
  code: ApiErrorCode,
  uploadId?: string,
) {
  console.warn(
    `[api-error] route=${route} uploadId=${uploadId || "-"} code=${code}`,
  );
}

function mapKnownErrorMessage(
  message: string,
  fallbackCode: ApiErrorCode,
  fallbackMessage: string,
  fallbackStatus: number,
) {
  if (message.includes("GEMINI_API_KEY")) {
    return appApiError(
      "MISSING_GEMINI_API_KEY",
      "Thiếu GEMINI_API_KEY. Hãy thêm key vào .env.local rồi restart dev server.",
      400,
    );
  }

  if (message.includes("Unsupported Gemini model")) {
    return appApiError(
      "INVALID_MODEL",
      "Model không hợp lệ. Vui lòng chọn model trong danh sách cho phép.",
      400,
      message,
    );
  }

  if (message.includes("high demand") || message.includes("UNAVAILABLE")) {
    return appApiError(
      fallbackCode,
      "Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau hoặc chọn Gemini 2.5 Flash.",
      503,
      message,
    );
  }

  if (
    message.includes("file processing timed out") ||
    message.includes("file processing failed")
  ) {
    return appApiError(
      fallbackCode,
      "Gemini chưa xử lý xong file media. Vui lòng thử lại sau ít phút.",
      503,
      message,
    );
  }

  if (message.includes("Unsupported file format")) {
    return appApiError(
      "INVALID_FILE_TYPE",
      "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
      400,
      message,
    );
  }

  if (message.includes("1GB")) {
    return appApiError(
      "FILE_TOO_LARGE",
      "File vượt quá giới hạn 1GB.",
      400,
      message,
    );
  }

  if (message.includes("Missing uploadId") || message.includes("Invalid uploadId")) {
    return appApiError(
      "MISSING_UPLOAD_ID",
      "Upload ID không hợp lệ hoặc bị thiếu.",
      400,
      message,
    );
  }

  if (message.includes("outside the upload folder")) {
    return appApiError(
      "INVALID_UPLOAD_PATH",
      "Đường dẫn file upload không hợp lệ.",
      400,
      message,
    );
  }

  if (message.includes("Uploaded file does not exist") || message.includes("ENOENT")) {
    return appApiError(
      "FILE_NOT_FOUND",
      "Không tìm thấy file đã upload. Vui lòng upload lại.",
      404,
      message,
    );
  }

  if (message.includes("Transcript is")) {
    return appApiError(
      "INVALID_TRANSCRIPT",
      "Transcript không hợp lệ hoặc đang rỗng.",
      400,
      message,
    );
  }

  return appApiError(fallbackCode, fallbackMessage, fallbackStatus, message);
}
