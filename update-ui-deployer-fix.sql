-- First, make sure the column exists
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS ui_deployer VARCHAR(42);
