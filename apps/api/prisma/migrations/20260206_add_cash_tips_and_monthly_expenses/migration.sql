-- AlterTable
ALTER TABLE "shift_assignments" ADD COLUMN "cash_tips" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "monthly_expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "food_costs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_expenses_organization_id_idx" ON "monthly_expenses"("organization_id");

-- CreateIndex
CREATE INDEX "monthly_expenses_year_month_idx" ON "monthly_expenses"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_expenses_organization_id_year_month_key" ON "monthly_expenses"("organization_id", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_expenses" ADD CONSTRAINT "monthly_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
