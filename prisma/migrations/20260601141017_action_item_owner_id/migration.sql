/*
  Warnings:

  - You are about to drop the column `owner` on the `ActionItem` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingNoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "ownerId" TEXT,
    "task" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "notes" TEXT NOT NULL,
    "lastReminderSent" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionItem_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "MeetingNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActionItem" ("createdAt", "deadline", "id", "lastReminderSent", "meetingNoteId", "notes", "organizationId", "priority", "status", "task", "updatedAt", "userId") SELECT "createdAt", "deadline", "id", "lastReminderSent", "meetingNoteId", "notes", "organizationId", "priority", "status", "task", "updatedAt", "userId" FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE INDEX "ActionItem_organizationId_idx" ON "ActionItem"("organizationId");
CREATE INDEX "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");
CREATE INDEX "ActionItem_lastReminderSent_idx" ON "ActionItem"("lastReminderSent");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
