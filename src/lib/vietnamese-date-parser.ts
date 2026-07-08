/**
 * Parse Vietnamese date expressions into actual date strings.
 * Used to normalize deadline fields from Gemini output.
 */

const TODAY = () => new Date();

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getNextWeekday(from: Date, targetDay: number): Date {
  const diff = (targetDay - from.getDay() + 7) % 7 || 7;
  return addDays(from, diff);
}

const WEEKDAY_MAP: Record<string, number> = {
  "chủ nhật": 0,
  "cn": 0,
  "thứ 2": 1,
  "thứ hai": 1,
  "t2": 1,
  "thứ 3": 2,
  "thứ ba": 2,
  "t3": 2,
  "thứ 4": 3,
  "thứ tư": 3,
  "t4": 3,
  "thứ 5": 4,
  "thứ năm": 4,
  "t5": 4,
  "thứ 6": 5,
  "thứ sáu": 5,
  "t6": 5,
  "thứ 7": 6,
  "thứ bảy": 6,
  "t7": 6,
};

/**
 * Try to parse a Vietnamese deadline string into an actual date string.
 * Returns the original string if no pattern matches.
 */
export function normalizeVietnameseDeadline(raw: string): string {
  if (!raw || raw === "Chưa xác định") return raw;

  const lower = raw.toLowerCase().trim();
  const now = TODAY();

  // "hôm nay" / "today"
  if (lower === "hôm nay" || lower === "today") {
    return formatDate(now);
  }

  // "ngày mai" / "mai" / "tomorrow"
  if (lower === "ngày mai" || lower === "mai" || lower === "tomorrow") {
    return formatDate(addDays(now, 1));
  }

  // "ngày kia" / "kia"
  if (lower === "ngày kia" || lower === "kia") {
    return formatDate(addDays(now, 2));
  }

  // "tuần sau" / "tuần tới" / "next week"
  if (lower.includes("tuần sau") || lower.includes("tuần tới") || lower.includes("next week")) {
    return formatDate(addDays(now, 7));
  }

  // "2 tuần sau" / "2 tuần tới" / "2 tuần nữa"
  const twoWeeksMatch = lower.match(/(\d+)\s*tuần\s*(sau|tới|nữa)/);
  if (twoWeeksMatch) {
    return formatDate(addDays(now, parseInt(twoWeeksMatch[1]) * 7));
  }

  // "tháng sau" / "tháng tới" / "next month"
  if (lower.includes("tháng sau") || lower.includes("tháng tới")) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return formatDate(nextMonth);
  }

  // "thứ X" / "tX" (next occurrence of weekday)
  for (const [pattern, dayIndex] of Object.entries(WEEKDAY_MAP)) {
    if (lower.includes(pattern)) {
      return formatDate(getNextWeekday(now, dayIndex));
    }
  }

  // "X ngày nữa" / "X ngày sau"
  const daysMatch = lower.match(/(\d+)\s*ngày\s*(nữa|sau|tới)/);
  if (daysMatch) {
    return formatDate(addDays(now, parseInt(daysMatch[1])));
  }

  // "cuối tuần" / "end of week"
  if (lower.includes("cuối tuần") || lower.includes("end of week")) {
    const saturday = getNextWeekday(now, 6);
    return formatDate(saturday);
  }

  // "cuối tháng" / "end of month"
  if (lower.includes("cuối tháng")) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return formatDate(endOfMonth);
  }

  // Already a date pattern (DD/MM/YYYY or DD-MM-YYYY)
  const dateMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    return raw; // already a date
  }

  return raw;
}

/**
 * Validate and normalize priority value.
 * Maps Vietnamese/variant priority strings to standard values.
 */
export function normalizePriority(raw: string): "High" | "Medium" | "Low" | "Chưa xác định" {
  if (!raw) return "Chưa xác định";

  const lower = raw.toLowerCase().trim();

  if (lower === "high" || lower === "cao" || lower === "gấp" || lower === "khẩn cấp" || lower === "urgent") {
    return "High";
  }

  if (lower === "medium" || lower === "trung bình" || lower === "vừa") {
    return "Medium";
  }

  if (lower === "low" || lower === "thấp" || lower === "không gấp") {
    return "Low";
  }

  return "Chưa xác định";
}

/**
 * Detect priority from urgency keywords in task text or notes.
 * Returns detected priority or null if no signal found.
 */
export function detectPriorityFromText(text: string): "High" | "Medium" | "Low" | null {
  const lower = text.toLowerCase();

  const lowSignals = ["khi nào rảnh", "không gấp", "từ từ", "low priority", "ưu tiên thấp", "có thời gian thì"];
  const highSignals = ["gấp", "khẩn cấp", "urgent", "asap", "ngay lập tức", "ngay", "sớm nhất", "ưu tiên cao"];

  if (lowSignals.some((s) => lower.includes(s))) return "Low";
  if (highSignals.some((s) => lower.includes(s))) return "High";

  return null;
}
