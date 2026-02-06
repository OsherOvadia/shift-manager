-- Add default hourly wage to business settings
ALTER TABLE "business_settings" ADD COLUMN "default_hourly_wage" FLOAT NOT NULL DEFAULT 30;
