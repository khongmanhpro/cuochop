-- FTS5 full-text search virtual tables
-- These are NOT managed by Prisma — they are virtual tables created with raw SQL.

-- 1. Meeting Notes FTS
CREATE VIRTUAL TABLE IF NOT EXISTS meeting_notes_fts USING fts5(
  title,
  markdown,
  organizationId,
  userId,
  content='MeetingNote',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Populate existing data
INSERT INTO meeting_notes_fts(rowid, title, markdown, organizationId, userId)
SELECT rowid, title, markdown, COALESCE(organizationId, ''), userId FROM MeetingNote;

-- Triggers to keep meeting_notes_fts in sync
CREATE TRIGGER IF NOT EXISTS meeting_notes_ai AFTER INSERT ON MeetingNote BEGIN
  INSERT INTO meeting_notes_fts(rowid, title, markdown, organizationId, userId)
  VALUES (new.rowid, new.title, new.markdown, COALESCE(new.organizationId, ''), new.userId);
END;

CREATE TRIGGER IF NOT EXISTS meeting_notes_ad AFTER DELETE ON MeetingNote BEGIN
  INSERT INTO meeting_notes_fts(meeting_notes_fts, rowid, title, markdown, organizationId, userId)
  VALUES ('delete', old.rowid, old.title, old.markdown, COALESCE(old.organizationId, ''), old.userId);
END;

CREATE TRIGGER IF NOT EXISTS meeting_notes_au AFTER UPDATE ON MeetingNote BEGIN
  INSERT INTO meeting_notes_fts(meeting_notes_fts, rowid, title, markdown, organizationId, userId)
  VALUES ('delete', old.rowid, old.title, old.markdown, COALESCE(old.organizationId, ''), old.userId);
  INSERT INTO meeting_notes_fts(rowid, title, markdown, organizationId, userId)
  VALUES (new.rowid, new.title, new.markdown, COALESCE(new.organizationId, ''), new.userId);
END;

-- 2. Decisions FTS
CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
  content,
  organizationId,
  userId,
  content='Decision',
  content_rowid='rowid',
  tokenize='unicode61'
);

INSERT INTO decisions_fts(rowid, content, organizationId, userId)
SELECT rowid, content, COALESCE(organizationId, ''), userId FROM Decision;

CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON Decision BEGIN
  INSERT INTO decisions_fts(rowid, content, organizationId, userId)
  VALUES (new.rowid, new.content, COALESCE(new.organizationId, ''), new.userId);
END;

CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON Decision BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, content, organizationId, userId)
  VALUES ('delete', old.rowid, old.content, COALESCE(old.organizationId, ''), old.userId);
END;

CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON Decision BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, content, organizationId, userId)
  VALUES ('delete', old.rowid, old.content, COALESCE(old.organizationId, ''), old.userId);
  INSERT INTO decisions_fts(rowid, content, organizationId, userId)
  VALUES (new.rowid, new.content, COALESCE(new.organizationId, ''), new.userId);
END;

-- 3. Action Items FTS
CREATE VIRTUAL TABLE IF NOT EXISTS action_items_fts USING fts5(
  task,
  notes,
  organizationId,
  userId,
  content='ActionItem',
  content_rowid='rowid',
  tokenize='unicode61'
);

INSERT INTO action_items_fts(rowid, task, notes, organizationId, userId)
SELECT rowid, task, notes, COALESCE(organizationId, ''), userId FROM ActionItem;

CREATE TRIGGER IF NOT EXISTS action_items_ai AFTER INSERT ON ActionItem BEGIN
  INSERT INTO action_items_fts(rowid, task, notes, organizationId, userId)
  VALUES (new.rowid, new.task, new.notes, COALESCE(new.organizationId, ''), new.userId);
END;

CREATE TRIGGER IF NOT EXISTS action_items_ad AFTER DELETE ON ActionItem BEGIN
  INSERT INTO action_items_fts(action_items_fts, rowid, task, notes, organizationId, userId)
  VALUES ('delete', old.rowid, old.task, old.notes, COALESCE(old.organizationId, ''), old.userId);
END;

CREATE TRIGGER IF NOT EXISTS action_items_au AFTER UPDATE ON ActionItem BEGIN
  INSERT INTO action_items_fts(action_items_fts, rowid, task, notes, organizationId, userId)
  VALUES ('delete', old.rowid, old.task, old.notes, COALESCE(old.organizationId, ''), old.userId);
  INSERT INTO action_items_fts(rowid, task, notes, organizationId, userId)
  VALUES (new.rowid, new.task, new.notes, COALESCE(new.organizationId, ''), new.userId);
END;
