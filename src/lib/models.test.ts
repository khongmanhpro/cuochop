import { describe, expect, test } from "vitest";
import { getGeminiModelId, modelOptions } from "./models";

describe("Gemini model allow-list", () => {
  test("maps UI labels to allowed Gemini model ids", () => {
    expect(getGeminiModelId("Gemini 2.5 Flash")).toBe("gemini-2.5-flash");
    expect(getGeminiModelId("Gemini 3 Flash Preview")).toBe(
      "gemini-3-flash-preview",
    );
    expect(getGeminiModelId("Gemini 3.1 Flash Lite Preview")).toBe(
      "gemini-3.1-flash-lite-preview",
    );
  });

  test("rejects model labels outside the allow-list", () => {
    expect(() => getGeminiModelId("gemini-3-pro-preview")).toThrow(
      "Unsupported Gemini model.",
    );
  });

  test("uses labels as select values so clients cannot send arbitrary ids", () => {
    expect(modelOptions.map((option) => option.value)).toEqual([
      "Gemini 2.5 Flash",
      "Gemini 3 Flash Preview",
      "Gemini 3.1 Flash Lite Preview",
    ]);
  });
});
