-- Extend users for account security, approval routing, and subsidiary access scope.
ALTER TABLE "users"
  ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "defaultSubsidiaryId" TEXT,
  ADD COLUMN "includeChildren" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvalLimit" DOUBLE PRECISION,
  ADD COLUMN "approvalCurrencyId" TEXT,
  ADD COLUMN "delegatedApproverUserId" TEXT,
  ADD COLUMN "delegationStartDate" TIMESTAMP(3),
  ADD COLUMN "delegationEndDate" TIMESTAMP(3);

CREATE TABLE "user_subsidiaries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_subsidiaries_pkey" PRIMARY KEY ("id")
);

INSERT INTO "user_subsidiaries" ("id", "userId", "entityId")
SELECT concat('usrsub_', md5(concat("id", "defaultSubsidiaryId"))), "id", "defaultSubsidiaryId"
FROM "users"
WHERE "defaultSubsidiaryId" IS NOT NULL;

CREATE UNIQUE INDEX "user_subsidiaries_userId_entityId_key" ON "user_subsidiaries"("userId", "entityId");
CREATE INDEX "user_subsidiaries_userId_idx" ON "user_subsidiaries"("userId");
CREATE INDEX "user_subsidiaries_entityId_idx" ON "user_subsidiaries"("entityId");

CREATE INDEX "users_defaultSubsidiaryId_idx" ON "users"("defaultSubsidiaryId");
CREATE INDEX "users_approvalCurrencyId_idx" ON "users"("approvalCurrencyId");
CREATE INDEX "users_delegatedApproverUserId_idx" ON "users"("delegatedApproverUserId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_defaultSubsidiaryId_fkey"
  FOREIGN KEY ("defaultSubsidiaryId") REFERENCES "subsidiaries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_approvalCurrencyId_fkey"
  FOREIGN KEY ("approvalCurrencyId") REFERENCES "currencies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_delegatedApproverUserId_fkey"
  FOREIGN KEY ("delegatedApproverUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_subsidiaries"
  ADD CONSTRAINT "user_subsidiaries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_subsidiaries"
  ADD CONSTRAINT "user_subsidiaries_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
