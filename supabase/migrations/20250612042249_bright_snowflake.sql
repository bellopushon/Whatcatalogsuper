/*
  # Add currency column to plans table

  1. Changes
    - Add `currency` column to `plans` table with default value 'usd'
    - Update existing records to have 'usd' as default currency
  
  2. Security
    - No RLS changes needed as existing policies will apply to new column
*/

-- Add currency column to plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'currency'
  ) THEN
    ALTER TABLE plans ADD COLUMN currency text DEFAULT 'usd' NOT NULL;
  END IF;
END $$;

-- Update any existing records to have the default currency
UPDATE plans SET currency = 'usd' WHERE currency IS NULL;