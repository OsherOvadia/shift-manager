-- Add enabled shift types to business settings (default: MORNING + EVENING merged)
ALTER TABLE "business_settings" ADD COLUMN "enabled_shift_types" JSONB DEFAULT '["MORNING","EVENING"]';
