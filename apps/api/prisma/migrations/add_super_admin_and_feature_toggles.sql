-- Add SUPER_ADMIN role to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Create OrganizationStatus enum
DO $$ BEGIN
    CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new fields to organizations table
ALTER TABLE "organizations" 
  ADD COLUMN IF NOT EXISTS "status" "OrganizationStatus" DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "contact_email" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Create index on status
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");

-- Make organizationId nullable for SUPER_ADMIN users
ALTER TABLE "users" 
  ALTER COLUMN "organization_id" DROP NOT NULL;

-- Add index on role
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");

-- Add feature toggle columns to business_settings
ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "enable_availability_submission" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "require_shift_approval" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enable_tip_tracking" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_cash_tip_tracking" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_revenue_breakdown" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_daily_revenue" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_financial_reports" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_monthly_overview" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_cook_payroll" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_excel_import" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_notifications" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_email_notifications" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enable_job_categories" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_kitchen_staff_separation" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_monthly_expenses" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enable_automatic_scheduling" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enable_shift_swapping" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enable_overtime_tracking" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Update existing organizations to APPROVED status (they're already live)
UPDATE "organizations" SET "status" = 'APPROVED', "approved_at" = CURRENT_TIMESTAMP WHERE "status" = 'PENDING';

-- Create super admin user (oser130309@gmail.com)
-- Password: Admin@123 (you should change this immediately after first login)
INSERT INTO "users" (id, email, password_hash, first_name, last_name, role, organization_id, is_active, is_approved, created_at)
VALUES (
  gen_random_uuid(),
  'oser130309@gmail.com',
  '$2b$10$YourHashedPasswordHere', -- You'll need to hash the password
  'Super',
  'Admin',
  'SUPER_ADMIN',
  NULL,
  true,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  role = 'SUPER_ADMIN',
  organization_id = NULL;

-- Comments
COMMENT ON COLUMN "organizations"."status" IS 'Organization approval status';
COMMENT ON COLUMN "organizations"."approved_by" IS 'User ID of super admin who approved';
COMMENT ON COLUMN "users"."organization_id" IS 'Nullable for SUPER_ADMIN users';
