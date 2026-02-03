-- AlterTable: Add actual time fields to shift_assignments
ALTER TABLE "shift_assignments" ADD COLUMN "actual_start_time" TEXT;
ALTER TABLE "shift_assignments" ADD COLUMN "actual_end_time" TEXT;
ALTER TABLE "shift_assignments" ADD COLUMN "actual_hours" DOUBLE PRECISION;

-- CreateTable: cook_weekly_hours for tracking cook payroll
CREATE TABLE "cook_weekly_hours" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "hourly_wage" DOUBLE PRECISION NOT NULL,
    "total_earnings" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cook_weekly_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cook_weekly_hours_organization_id_idx" ON "cook_weekly_hours"("organization_id");

-- CreateIndex
CREATE INDEX "cook_weekly_hours_user_id_idx" ON "cook_weekly_hours"("user_id");

-- CreateIndex
CREATE INDEX "cook_weekly_hours_week_start_idx" ON "cook_weekly_hours"("week_start");

-- CreateIndex
CREATE UNIQUE INDEX "cook_weekly_hours_organization_id_user_id_week_start_key" ON "cook_weekly_hours"("organization_id", "user_id", "week_start");

-- AddForeignKey
ALTER TABLE "cook_weekly_hours" ADD CONSTRAINT "cook_weekly_hours_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cook_weekly_hours" ADD CONSTRAINT "cook_weekly_hours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
