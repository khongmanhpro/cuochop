import { prisma } from "./db";

export type SearchResult = {
  type: "note" | "decision" | "action";
  id: string;
  title: string;
  snippet: string;
  meetingDate: Date;
  meetingTitle: string;
  meetingId: string;
};

export async function searchContent(
  query: string,
  userId: string,
  orgId?: string | null,
): Promise<SearchResult[]> {
  const sanitized = sanitizeFtsQuery(query);
  if (!sanitized || sanitized.length < 2) return [];

  const ftsQuery = `${sanitized}*`;

  const [notes, decisions, actions] = await Promise.all([
    searchNotes(ftsQuery, buildScope("meeting_notes_fts", userId, orgId)),
    searchDecisions(ftsQuery, buildScope("decisions_fts", userId, orgId)),
    searchActions(ftsQuery, buildScope("action_items_fts", userId, orgId)),
  ]);

  return [...notes, ...decisions, ...actions]
    .sort((a, b) => b.meetingDate.getTime() - a.meetingDate.getTime())
    .slice(0, 30);
}

async function searchNotes(
  ftsQuery: string,
  scope: string,
): Promise<SearchResult[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      markdown: string;
      createdAt: Date;
      meetingTitle: string;
      meetingId: string;
      rank: number;
    }>
  >(`
    SELECT
      mn.id,
      mn.title,
      snippet(meeting_notes_fts, 1, '<mark>', '</mark>', '...', 32) AS markdown,
      mn.createdAt,
      mn.title AS meetingTitle,
      mn.id AS meetingId,
      bm25(meeting_notes_fts, 5.0, 1.0, 0.0, 0.0) AS rank
    FROM meeting_notes_fts
    JOIN MeetingNote mn ON mn.rowid = meeting_notes_fts.rowid
    WHERE meeting_notes_fts MATCH '${escapeSql(ftsQuery)}'
      AND ${scope}
    ORDER BY rank
    LIMIT 10
  `);

  return rows.map((r) => ({
    type: "note" as const,
    id: r.id,
    title: r.title,
    snippet: r.markdown,
    meetingDate: r.createdAt,
    meetingTitle: r.meetingTitle,
    meetingId: r.meetingId,
  }));
}

async function searchDecisions(
  ftsQuery: string,
  scope: string,
): Promise<SearchResult[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      content: string;
      createdAt: Date;
      meetingTitle: string;
      meetingId: string;
      rank: number;
    }>
  >(`
    SELECT
      d.id,
      snippet(decisions_fts, 0, '<mark>', '</mark>', '...', 32) AS content,
      d.createdAt,
      mn.title AS meetingTitle,
      mn.id AS meetingId,
      bm25(decisions_fts, 1.0, 0.0, 0.0) AS rank
    FROM decisions_fts
    JOIN Decision d ON d.rowid = decisions_fts.rowid
    JOIN MeetingNote mn ON mn.id = d.meetingNoteId
    WHERE decisions_fts MATCH '${escapeSql(ftsQuery)}'
      AND ${scope}
    ORDER BY rank
    LIMIT 10
  `);

  return rows.map((r) => ({
    type: "decision" as const,
    id: r.id,
    title: truncate(r.content, 80),
    snippet: r.content,
    meetingDate: r.createdAt,
    meetingTitle: r.meetingTitle,
    meetingId: r.meetingId,
  }));
}

async function searchActions(
  ftsQuery: string,
  scope: string,
): Promise<SearchResult[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      task: string;
      notes: string;
      createdAt: Date;
      meetingTitle: string;
      meetingId: string;
      rank: number;
    }>
  >(`
    SELECT
      ai.id,
      snippet(action_items_fts, 0, '<mark>', '</mark>', '...', 32) AS task,
      snippet(action_items_fts, 1, '<mark>', '</mark>', '...', 32) AS notes,
      ai.createdAt,
      mn.title AS meetingTitle,
      mn.id AS meetingId,
      bm25(action_items_fts, 5.0, 1.0, 0.0, 0.0) AS rank
    FROM action_items_fts
    JOIN ActionItem ai ON ai.rowid = action_items_fts.rowid
    JOIN MeetingNote mn ON mn.id = ai.meetingNoteId
    WHERE action_items_fts MATCH '${escapeSql(ftsQuery)}'
      AND ${scope}
    ORDER BY rank
    LIMIT 10
  `);

  return rows.map((r) => ({
    type: "action" as const,
    id: r.id,
    title: r.task,
    snippet: r.notes || r.task,
    meetingDate: r.createdAt,
    meetingTitle: r.meetingTitle,
    meetingId: r.meetingId,
  }));
}

function buildScope(
  tableName: "meeting_notes_fts" | "decisions_fts" | "action_items_fts",
  userId: string,
  orgId?: string | null,
): string {
  return orgId
    ? `${tableName}.organizationId = '${escapeSql(orgId)}'`
    : `${tableName}.userId = '${escapeSql(userId)}'`;
}

export function sanitizeFtsQuery(input: string): string {
  // Remove FTS5 special characters, keep alphanumeric and Vietnamese chars
  let cleaned = input
    .replace(/['"()*:^~\-\\;<>|&={}[\]]/g, " ")
    // Strip FTS5 boolean operators as whole words (case-insensitive)
    .replace(/\b(?:OR|AND|NOT|NEAR)\b/gi, " ")
    // Strip SQL comment markers
    .replace(/--/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // FTS5 queries have a max term length of 32768 bytes; cap to be safe
  if (cleaned.length > 1024) {
    cleaned = cleaned.slice(0, 1024).trim();
  }

  return cleaned;
}

export function escapeSql(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\x00/g, "");
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen).trimEnd() + "...";
}
