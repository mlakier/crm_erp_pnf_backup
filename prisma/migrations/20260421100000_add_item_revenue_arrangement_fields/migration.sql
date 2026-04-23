ALTER TABLE "items"
ADD COLUMN IF NOT EXISTS "createRevenueArrangementOn" TEXT,
ADD COLUMN IF NOT EXISTS "createForecastPlanOn" TEXT,
ADD COLUMN IF NOT EXISTS "createRevenuePlanOn" TEXT,
ADD COLUMN IF NOT EXISTS "allocationEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "performanceObligationType" TEXT;
