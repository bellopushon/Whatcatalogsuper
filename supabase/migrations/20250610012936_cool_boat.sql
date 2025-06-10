/*
  # Fix Plans Table Structure and User Plan Column Type

  1. Changes
    - Convert users.plan column from enum to text to store plan UUIDs
    - Ensure plans table has proper UUID structure
    - Insert default plans with UUIDs
    - Update users to reference plan UUIDs

  2. Security
    - Maintain existing RLS policies
    - Add performance indexes
*/

-- Drop existing constraints that might conflict
DROP INDEX IF EXISTS idx_plans_single_free;
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;

-- Clear existing plans to avoid conflicts
DELETE FROM plans;

-- First, change the users.plan column from enum to text to store UUIDs
ALTER TABLE users ALTER COLUMN plan TYPE text;

-- Ensure the plans table has proper structure with UUID primary key
DO $$
BEGIN
  -- Check if id column needs to be recreated as UUID with default
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' 
    AND column_name = 'id' 
    AND data_type != 'uuid'
  ) THEN
    -- Drop and recreate the id column with proper UUID type and default
    ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_pkey;
    ALTER TABLE plans DROP COLUMN IF EXISTS id;
    ALTER TABLE plans ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' 
    AND column_name = 'id' 
    AND column_default LIKE '%gen_random_uuid%'
  ) THEN
    -- Just set the default if column exists but doesn't have default
    ALTER TABLE plans ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END$$;

-- Add missing columns if they don't exist
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;

-- Add constraints one by one to avoid syntax errors
DO $$
BEGIN
  -- Add level check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plans_level_check' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_level_check CHECK (level >= 1);
  END IF;

  -- Add price check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plans_price_check' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_price_check CHECK (price >= 0);
  END IF;

  -- Add max_stores check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plans_max_stores_check' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_max_stores_check CHECK (max_stores >= 1);
  END IF;

  -- Add max_products check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plans_max_products_check' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_max_products_check CHECK (max_products >= 1);
  END IF;

  -- Add max_categories check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'plans_max_categories_check' 
    AND table_name = 'plans'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_max_categories_check CHECK (max_categories >= 1);
  END IF;
END$$;

-- Create unique index for free plans (only one free plan allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_single_free 
ON plans (is_free) 
WHERE (is_free = true);

-- Create other indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_is_free ON plans(is_free);
CREATE INDEX IF NOT EXISTS idx_plans_level ON plans(level);
CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price);

-- Create trigger for updated_at
CREATE TRIGGER update_plans_updated_at 
BEFORE UPDATE ON plans 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans with proper UUID structure
-- We'll generate UUIDs and store them in variables for reference
DO $$
DECLARE
  gratuito_id uuid := gen_random_uuid();
  emprendedor_id uuid := gen_random_uuid();
  profesional_id uuid := gen_random_uuid();
BEGIN
  -- Insert the three default plans
  INSERT INTO plans (
    id,
    name,
    description,
    price,
    max_stores,
    max_products,
    max_categories,
    features,
    is_active,
    is_free,
    level,
    created_at,
    updated_at
  ) VALUES 
  (
    gratuito_id,
    'Gratuito',
    'Plan básico gratuito para empezar',
    0,
    1,
    10,
    3,
    '["1 tienda", "10 productos", "3 categorías", "Soporte básico"]'::jsonb,
    true,
    true,
    1,
    now(),
    now()
  ),
  (
    emprendedor_id,
    'Emprendedor',
    'Para pequeños negocios en crecimiento',
    4.99,
    2,
    30,
    999999,
    '["2 tiendas", "30 productos por tienda", "Categorías ilimitadas", "Personalización avanzada", "Soporte prioritario"]'::jsonb,
    true,
    false,
    2,
    now(),
    now()
  ),
  (
    profesional_id,
    'Profesional',
    'Para empresas establecidas',
    9.99,
    5,
    50,
    999999,
    '["5 tiendas", "50 productos por tienda", "Categorías ilimitadas", "Analíticas avanzadas", "Personalización completa", "Soporte 24/7"]'::jsonb,
    true,
    false,
    3,
    now(),
    now()
  );

  -- Update users to use the new plan IDs based on their current plan names
  -- First, set all users to the free plan by default
  UPDATE users SET plan = gratuito_id::text;
  
  -- Then update specific plans if they exist (handle both Spanish and English names)
  UPDATE users 
  SET plan = emprendedor_id::text 
  WHERE plan IN ('emprendedor', 'entrepreneur');
  
  UPDATE users 
  SET plan = profesional_id::text 
  WHERE plan IN ('profesional', 'professional');
END$$;

-- Add index on users.plan for better performance
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);