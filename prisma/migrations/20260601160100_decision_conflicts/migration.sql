-- CreateTable
CREATE TABLE "DecisionConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "decisionId" TEXT NOT NULL,
    "conflictingId" TEXT NOT NULL,
    "similarity" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionConflict_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DecisionConflict_conflictingId_fkey" FOREIGN KEY ("conflictingId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionConflict_decisionId_conflictingId_key" ON "DecisionConflict"("decisionId", "conflictingId");

-- CreateIndex
CREATE INDEX "DecisionConflict_decisionId_idx" ON "DecisionConflict"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionConflict_conflictingId_idx" ON "DecisionConflict"("conflictingId");
