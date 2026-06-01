-- Add OAuth account linking and session auth method tracking.
ALTER TABLE "User" ADD COLUMN "passwordAuthEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Session" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'password';

CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "OAuthAccount"("userId", "provider");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
