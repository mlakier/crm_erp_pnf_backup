-- Add active flag for contacts; UI exposes this as Inactive (inverse)
ALTER TABLE "contacts" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
