-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_roleId_key" ON "roles"("roleId");

-- Backfill: insert distinct roles from existing users
INSERT INTO "roles" ("id", "roleId", "name", "updatedAt")
SELECT
    gen_random_uuid(),
    'ROLE-' || LPAD(ROW_NUMBER() OVER (ORDER BY "role")::TEXT, 4, '0'),
    "role",
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "role" FROM "users" WHERE "role" IS NOT NULL AND "role" <> '') AS distinct_roles;

-- Add role_id column to users
ALTER TABLE "users" ADD COLUMN "role_id" TEXT;

-- Backfill: set role_id FK from existing role string
UPDATE "users" u
SET "role_id" = r."id"
FROM "roles" r
WHERE r."name" = u."role";

-- Drop old role column
ALTER TABLE "users" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
