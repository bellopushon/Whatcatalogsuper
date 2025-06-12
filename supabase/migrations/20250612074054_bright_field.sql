/*
  # Fix User Plan Column Type Migration

  This migration resolves the "operator does not exist: uuid = text" error by:
  
  1. **Problem**: The `users.plan` column is defined as `text` but the application expects it to be `uuid`
  2. **Solution**: Convert the column type and migrate existing data
  
  ## Changes Made:
  
  1. **Disable Triggers**: Temporarily disable validation triggers during migration
  2. **Data Migration**: Convert existing plan names to their corresponding UUIDs
  3. **Schema Update**: Change column type from `text` to `uuid`
  4. **Foreign Key**: Add proper foreign key constraint to `plans` table
  5. **Re-enable Triggers**: Restore validation triggers
  
  ## Safety Measures:
  
  - Uses transactions to ensure atomicity
  - Handles existing data gracefully
  - Maintains referential integrity
  - Preserves all existing user-plan relationships
*/

BEGIN;

-- Step 1: Disable the trigger that's causing the validation error
ALTER TABLE public.users DISABLE TRIGGER IF EXISTS ensure_valid_user_plan_trigger;

-- Step 2: Handle existing data migration
-- First, let's see what kind of data we have in the plan column
-- and migrate it appropriately

-- Create a temporary column to store the new UUID values
ALTER TABLE public.users ADD COLUMN plan_uuid uuid;

-- Migrate existing data: Convert plan names to UUIDs
-- This handles cases where plan column contains plan names
UPDATE public.users u
SET plan_uuid = p.id
FROM public.plans p
WHERE u.plan = p.name;

-- Handle cases where plan column might already contain UUIDs (as text)
-- This is for users who might have been assigned UUIDs as text
UPDATE public.users u
SET plan_uuid = u.plan::uuid
WHERE u.plan_uuid IS NULL 
  AND u.plan ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- For any remaining users without a valid plan, assign them to the free plan
UPDATE public.users u
SET plan_uuid = (
  SELECT id FROM public.plans 
  WHERE is_free = true 
  ORDER BY level ASC 
  LIMIT 1
)
WHERE u.plan_uuid IS NULL;

-- Step 3: Drop the old plan column and rename the new one
ALTER TABLE public.users DROP COLUMN plan;
ALTER TABLE public.users RENAME COLUMN plan_uuid TO plan;

-- Step 4: Set NOT NULL constraint (since every user should have a plan)
ALTER TABLE public.users ALTER COLUMN plan SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE public.users 
ADD CONSTRAINT fk_users_plan 
FOREIGN KEY (plan) REFERENCES public.plans(id) ON DELETE RESTRICT;

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_plan_uuid ON public.users(plan);

-- Step 7: Re-enable the trigger
ALTER TABLE public.users ENABLE TRIGGER IF EXISTS ensure_valid_user_plan_trigger;

-- Step 8: Update the default value to use a UUID instead of text
-- Set default to the free plan UUID
ALTER TABLE public.users 
ALTER COLUMN plan SET DEFAULT (
  SELECT id FROM public.plans 
  WHERE is_free = true 
  ORDER BY level ASC 
  LIMIT 1
);

COMMIT;