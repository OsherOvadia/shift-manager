-- Add shift requirements JSON to business settings
ALTER TABLE "business_settings" ADD COLUMN "shift_requirements" JSONB DEFAULT '{}';
