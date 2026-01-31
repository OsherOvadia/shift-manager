-- AlterTable
ALTER TABLE "users" ADD COLUMN "base_hourly_wage" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "is_tip_based" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shift_assignments" ADD COLUMN "tips_earned" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "daily_revenues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_revenue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_revenues_organization_id_idx" ON "daily_revenues"("organization_id");

-- CreateIndex
CREATE INDEX "daily_revenues_date_idx" ON "daily_revenues"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_revenues_organization_id_date_key" ON "daily_revenues"("organization_id", "date");
