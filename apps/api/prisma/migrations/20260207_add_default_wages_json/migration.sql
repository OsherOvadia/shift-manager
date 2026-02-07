-- Add per-category default wages JSON to business settings
ALTER TABLE "business_settings" ADD COLUMN "default_wages" JSONB DEFAULT '{}';
