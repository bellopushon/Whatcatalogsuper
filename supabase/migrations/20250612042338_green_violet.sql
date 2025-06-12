/*
  # Add interval column to plans table

  1. Changes
    - Add `interval` column to `plans` table with default value 'month'
    - This column stores the billing interval for subscription plans (month/year)

  2. Notes
    - Default value is set to 'month' for existing plans
    - Column is nullable to maintain flexibility
    - Existing plans will automatically get 'month' as their interval
*/

-- Add interval column to plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'interval'
  ) THEN
    ALTER TABLE plans ADD COLUMN interval text DEFAULT 'month';
  END IF;
END $$;

-- Add index for interval column for better query performance
CREATE INDEX IF NOT EXISTS idx_plans_interval ON plans(interval);