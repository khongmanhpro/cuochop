import { describe, expect, test, vi, afterAll } from "vitest";
import {
  normalizeVietnameseDeadline,
  normalizePriority,
  detectPriorityFromText,
} from "./vietnamese-date-parser";

// Mock today to 2026-07-07 (Tuesday)
const fixedDate = new Date("2026-07-07T12:00:00");
vi.useFakeTimers();
vi.setSystemTime(fixedDate);

afterAll(() => {
  vi.useRealTimers();
});

describe("normalizeVietnameseDeadline", () => {
  test("returns 'Chưa xác định' unchanged", () => {
    expect(normalizeVietnameseDeadline("Chưa xác định")).toBe("Chưa xác định");
  });

  test("parses 'hôm nay'", () => {
    expect(normalizeVietnameseDeadline("hôm nay")).toBe("07/07/2026");
  });

  test("parses 'ngày mai'", () => {
    expect(normalizeVietnameseDeadline("ngày mai")).toBe("08/07/2026");
  });

  test("parses 'mai'", () => {
    expect(normalizeVietnameseDeadline("mai")).toBe("08/07/2026");
  });

  test("parses 'ngày kia'", () => {
    expect(normalizeVietnameseDeadline("ngày kia")).toBe("09/07/2026");
  });

  test("parses 'tuần sau'", () => {
    expect(normalizeVietnameseDeadline("tuần sau")).toBe("14/07/2026");
  });

  test("parses '2 tuần nữa'", () => {
    expect(normalizeVietnameseDeadline("2 tuần nữa")).toBe("21/07/2026");
  });

  test("parses weekday 'thứ 6'", () => {
    // Tuesday 2026-07-07, next Friday is 2026-07-10
    expect(normalizeVietnameseDeadline("thứ 6")).toBe("10/07/2026");
  });

  test("parses weekday 'thứ hai'", () => {
    // Tuesday, next Monday is 2026-07-13
    expect(normalizeVietnameseDeadline("thứ hai")).toBe("13/07/2026");
  });

  test("parses '3 ngày nữa'", () => {
    expect(normalizeVietnameseDeadline("3 ngày nữa")).toBe("10/07/2026");
  });

  test("parses 'cuối tuần'", () => {
    // Next Saturday from Tuesday
    expect(normalizeVietnameseDeadline("cuối tuần")).toBe("11/07/2026");
  });

  test("keeps existing date format", () => {
    expect(normalizeVietnameseDeadline("15/07/2026")).toBe("15/07/2026");
  });

  test("returns unmatched strings unchanged", () => {
    expect(normalizeVietnameseDeadline("khi nào xong")).toBe("khi nào xong");
  });
});

describe("normalizePriority", () => {
  test("normalizes 'High' variants", () => {
    expect(normalizePriority("High")).toBe("High");
    expect(normalizePriority("cao")).toBe("High");
    expect(normalizePriority("gấp")).toBe("High");
    expect(normalizePriority("khẩn cấp")).toBe("High");
  });

  test("normalizes 'Medium' variants", () => {
    expect(normalizePriority("Medium")).toBe("Medium");
    expect(normalizePriority("trung bình")).toBe("Medium");
  });

  test("normalizes 'Low' variants", () => {
    expect(normalizePriority("Low")).toBe("Low");
    expect(normalizePriority("thấp")).toBe("Low");
    expect(normalizePriority("không gấp")).toBe("Low");
  });

  test("returns 'Chưa xác định' for unknown", () => {
    expect(normalizePriority("")).toBe("Chưa xác định");
    expect(normalizePriority("abc")).toBe("Chưa xác định");
  });
});

describe("detectPriorityFromText", () => {
  test("detects High from urgency keywords", () => {
    expect(detectPriorityFromText("Cần gấp trong hôm nay")).toBe("High");
    expect(detectPriorityFromText("Việc này urgent")).toBe("High");
  });

  test("detects Low from relaxed keywords", () => {
    expect(detectPriorityFromText("Khi nào rảnh thì làm")).toBe("Low");
    expect(detectPriorityFromText("Không gấp, từ từ cũng được")).toBe("Low");
  });

  test("returns null for neutral text", () => {
    expect(detectPriorityFromText("Gửi báo cáo cho team")).toBeNull();
  });
});
