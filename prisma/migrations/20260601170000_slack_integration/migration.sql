-- Add Slack integration settings to organizations.
ALTER TABLE "Organization" ADD COLUMN "slackAutoPostEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SlackIntegration" (
    "organizationId" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "channelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlackIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SlackIntegration_teamId_idx" ON "SlackIntegration"("teamId");
