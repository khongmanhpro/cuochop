import { prisma } from "./db";

export type DetectedConflict = {
  existingDecisionId: string;
  existingContent: string;
  similarity: number;
  reason: string;
};

const NEGATION_PAIRS: [RegExp, RegExp][] = [
  [/(\b)\s*sẽ\s+(\w+)/i, /(\b)\s*không\s+sẽ\s+(\w+)/i],
  [/(\b)\s*đồng\s+ý/i, /(\b)\s*không\s+đồng\s+ý/i],
  [/(\b)\s*chấp\s+nhận/i, /(\b)\s*từ\s+chối/i],
  [/(\b)\s*bật\s+/i, /(\b)\s*tắt\s+/i],
  [/(\b)\s*bật/i, /(\b)\s*tắt/i],
  [/(\b)\s*thêm\s+/i, /(\b)\s*bỏ\s+/i],
  [/(\b)\s*tăng\s+/i, /(\b)\s*giảm\s+/i],
  [/(\b)\s*mở\s+/i, /(\b)\s*đóng\s+/i],
];

export async function detectConflicts(
  newDecisionId: string,
  newContent: string,
  organizationId?: string | null,
  userId?: string,
): Promise<DetectedConflict[]> {
  const existingDecisions = await prisma.decision.findMany({
    where: organizationId
      ? { organizationId, id: { not: newDecisionId } }
      : userId
        ? { userId, id: { not: newDecisionId } }
        : { id: { not: newDecisionId } },
    select: { id: true, content: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const conflicts: DetectedConflict[] = [];

  for (const existing of existingDecisions) {
    const similarity = computeKeywordOverlap(newContent, existing.content);
    if (similarity < 0.15) continue;

    const negation = detectNegation(newContent, existing.content);
    if (negation) {
      conflicts.push({
        existingDecisionId: existing.id,
        existingContent: existing.content,
        similarity: Math.max(similarity, 0.6),
        reason: negation,
      });
      continue;
    }

    if (similarity >= 0.5) {
      conflicts.push({
        existingDecisionId: existing.id,
        existingContent: existing.content,
        similarity,
        reason: "Nội dung tương tự cao — có thể trùng lặp hoặc mâu thuẫn.",
      });
    }
  }

  return conflicts.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

export async function persistConflicts(
  decisionId: string,
  conflicts: DetectedConflict[],
): Promise<void> {
  if (conflicts.length === 0) return;

  await prisma.$transaction(
    conflicts.map((c) =>
      prisma.decisionConflict.upsert({
        where: {
          decisionId_conflictingId: {
            decisionId,
            conflictingId: c.existingDecisionId,
          },
        },
        create: {
          decisionId,
          conflictingId: c.existingDecisionId,
          similarity: c.similarity,
          reason: c.reason,
        },
        update: {
          similarity: c.similarity,
          reason: c.reason,
        },
      }),
    ),
  );
}

export function computeKeywordOverlap(a: string, b: string): number {
  const wordsA = extractKeywords(a);
  const wordsB = extractKeywords(b);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap / union;
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    "và",
    "của",
    "là",
    "cho",
    "với",
    "các",
    "một",
    "để",
    "trong",
    "có",
    "được",
    "không",
    "này",
    "đó",
    "từ",
    "nhưng",
    "hay",
    "hoặc",
    "sẽ",
    "đã",
    "đang",
    "thì",
    "cũng",
    "như",
    "khi",
    "nếu",
    "vì",
    "tại",
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "it",
    "its",
    "this",
    "that",
    "we",
    "they",
    "he",
    "she",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "and",
    "or",
    "but",
    "not",
    "no",
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w)),
  );
}

export function detectNegation(a: string, b: string): string | null {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  for (const [positive, negative] of NEGATION_PAIRS) {
    const aHasPositive = positive.test(aLower);
    const aHasNegative = negative.test(aLower);
    const bHasPositive = positive.test(bLower);
    const bHasNegative = negative.test(bLower);

    if (
      (aHasPositive && bHasNegative) ||
      (aHasNegative && bHasPositive)
    ) {
      return `Phát hiện phủ định đối lập: "${truncate(a, 50)}" vs "${truncate(b, 50)}"`;
    }
  }

  return null;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen).trimEnd() + "...";
}
