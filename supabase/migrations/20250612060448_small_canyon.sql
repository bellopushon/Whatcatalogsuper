-- Add Stripe product and price IDs to plans table
DO $$
BEGIN
  -- Add stripe_product_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'stripe_product_id'
  ) THEN
    ALTER TABLE plans ADD COLUMN stripe_product_id varchar(255);
  END IF;

  -- Add stripe_price_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE plans ADD COLUMN stripe_price_id varchar(255);
  END IF;
END $$;

-- Add indexes for better query performance (using IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_plans_stripe_product_id ON plans(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_id ON plans(stripe_price_id);

-- Add unique constraints only if they don't exist
DO $$
BEGIN
  -- Add unique constraint for stripe_product_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'plans' 
    AND constraint_name = 'plans_stripe_product_id_key'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_stripe_product_id_key UNIQUE (stripe_product_id);
  END IF;

  -- Add unique constraint for stripe_price_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'plans' 
    AND constraint_name = 'plans_stripe_price_id_key'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_stripe_price_id_key UNIQUE (stripe_price_id);
  END IF;
END $$;