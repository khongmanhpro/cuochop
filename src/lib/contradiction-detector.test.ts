import { describe, expect, test } from "vitest";
import { computeKeywordOverlap, detectNegation } from "./contradiction-detector";

// Export internal functions for testing
// These are tested via the module's internal logic

describe("keyword overlap", () => {
  test("identical texts have high overlap", () => {
    const a = "Chúng ta sẽ sử dụng React cho frontend";
    const b = "Chúng ta sẽ sử dụng React cho frontend";
    expect(computeKeywordOverlap(a, b)).toBeGreaterThan(0.8);
  });

  test("completely different texts have low overlap", () => {
    const a = "Sử dụng React cho frontend";
    const b = "Hôm nay trời đẹp và mát mẻ";
    expect(computeKeywordOverlap(a, b)).toBeLessThan(0.2);
  });

  test("partially overlapping texts have medium overlap", () => {
    const a = "Sử dụng React cho frontend và Node cho backend";
    const b = "Sử dụng Vue cho frontend và Python cho backend";
    expect(computeKeywordOverlap(a, b)).toBeGreaterThan(0.2);
    expect(computeKeywordOverlap(a, b)).toBeLessThan(0.8);
  });

  test("empty texts have zero overlap", () => {
    expect(computeKeywordOverlap("", "hello")).toBe(0);
    expect(computeKeywordOverlap("hello", "")).toBe(0);
  });
});

describe("negation detection", () => {
  test("detects đồng ý vs không đồng ý", () => {
    const result = detectNegation(
      "Team đồng ý sử dụng framework mới",
      "Team không đồng ý sử dụng framework mới",
    );
    expect(result).not.toBeNull();
  });

  test("detects bật vs tắt", () => {
    const result = detectNegation(
      "Quyết định bật tính năng dark mode",
      "Quyết định tắt tính năng dark mode",
    );
    expect(result).not.toBeNull();
  });

  test("detects tăng vs giảm", () => {
    const result = detectNegation(
      "Tăng ngân sách marketing lên 50%",
      "Giảm ngân sách marketing xuống 30%",
    );
    expect(result).not.toBeNull();
  });

  test("returns null for non-negation pairs", () => {
    const result = detectNegation(
      "Sử dụng TypeScript cho project mới",
      "Sử dụng JavaScript cho project cũ",
    );
    expect(result).toBeNull();
  });

  test("returns null for similar non-negated texts", () => {
    const result = detectNegation(
      "Team sẽ họp vào thứ Hai",
      "Team sẽ họp vào thứ Ba",
    );
    expect(result).toBeNull();
  });

  test("detects chấp thuận vs bác bỏ", () => {
    const result = detectNegation(
      "Hội đồng chấp thuận ngân sách Q3",
      "Hội đồng bác bỏ ngân sách Q3",
    );
    expect(result).not.toBeNull();
  });

  test("detects ký vs hủy ký", () => {
    const result = detectNegation(
      "Chúng ta sẽ ký hợp đồng với vendor A",
      "Chúng ta sẽ hủy ký hợp đồng với vendor A",
    );
    expect(result).not.toBeNull();
  });

  test("detects chấp nhận vs từ chối", () => {
    const result = detectNegation(
      "PM chấp nhận đề xuất thay đổi scope",
      "PM từ chối đề xuất thay đổi scope",
    );
    expect(result).not.toBeNull();
  });
});
