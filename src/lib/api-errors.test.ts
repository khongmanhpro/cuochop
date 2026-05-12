import { describe, expect, test, vi } from "vitest";
import {
  appApiError,
  createApiErrorResponse,
  toApiError,
} from "./api-errors";

describe("api errors", () => {
  test("maps missing Gemini key to a stable error code", () => {
    const error = toApiError(
      new Error("Missing GEMINI_API_KEY. Please set it in .env.local."),
      "INTERNAL_ERROR",
      "Fallback",
    );

    expect(error.code).toBe("MISSING_GEMINI_API_KEY");
    expect(error.message).toBe(
      "Thiếu GEMINI_API_KEY. Hãy thêm key vào .env.local rồi restart dev server.",
    );
  });

  test("creates standardized JSON error responses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const response = createApiErrorResponse(
        appApiError("INVALID_MODEL", "Model không hợp lệ."),
        {
          route: "/api/test",
          uploadId: "upload_123",
          fallbackCode: "INTERNAL_ERROR",
          fallbackMessage: "Fallback",
        },
      );

      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "INVALID_MODEL",
          message: "Model không hợp lệ.",
        },
      });
    } finally {
      warn.mockRestore();
    }
  });

  test("maps Gemini high demand errors to a clear retry message", () => {
    const error = toApiError(
      new Error(
        '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
      ),
      "TRANSCRIPTION_FAILED",
      "Fallback",
    );

    expect(error.code).toBe("TRANSCRIPTION_FAILED");
    expect(error.status).toBe(503);
    expect(error.message).toBe(
      "Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau hoặc chọn Gemini 2.5 Flash.",
    );
  });
});
