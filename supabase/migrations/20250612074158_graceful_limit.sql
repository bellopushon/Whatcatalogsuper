/*
  # Fix User Plan Column Type

  This migration fixes the type mismatch issue with the users.plan column by:
  1. Converting the column from text to uuid
  2. Migrating existing data safely
  3. Adding proper foreign key constraints
  4. Handling edge cases and ensuring data integrity

  ## Changes Made
  - Convert users.plan from text to uuid type
  - Migrate existing plan data (names to UUIDs)
  - Add foreign key constraint to plans table
  - Set proper default values
  - Handle users with invalid plan references
*/

BEGIN;

-- Step 1: Disable the trigger that's causing validation errors
-- We'll check if the trigger exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'ensure_valid_user_plan_trigger' 
        AND tgrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users DISABLE TRIGGER ensure_valid_user_plan_trigger;
    END IF;
END $$;

-- Step 2: Create a temporary column to store UUID values
ALTER TABLE public.users ADD COLUMN plan_uuid uuid;

-- Step 3: Migrate existing data
-- First, handle cases where plan column contains plan names
UPDATE public.users u
SET plan_uuid = p.id
FROM public.plans p
WHERE u.plan = p.name
  AND u.plan_uuid IS NULL;

-- Handle cases where plan column contains UUID strings
UPDATE public.users u
SET plan_uuid = u.plan::uuid
WHERE u.plan_uuid IS NULL 
  AND u.plan IS NOT NULL
  AND u.plan ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.plans WHERE id = u.plan::uuid);

-- For users with invalid or missing plan references, assign them to the free plan
UPDATE public.users u
SET plan_uuid = (
  SELECT id FROM public.plans 
  WHERE is_free = true 
  ORDER BY level ASC 
  LIMIT 1
)
WHERE u.plan_uuid IS NULL;

-- Step 4: Verify all users have valid plan assignments
-- If no free plan exists, create a basic one
DO $$
DECLARE
    free_plan_id uuid;
    users_without_plan integer;
BEGIN
    -- Check if there are users still without plans
    SELECT COUNT(*) INTO users_without_plan
    FROM public.users
    WHERE plan_uuid IS NULL;
    
    IF users_without_plan > 0 THEN
        -- Get or create a free plan
        SELECT id INTO free_plan_id
        FROM public.plans
        WHERE is_free = true
        ORDER BY level ASC
        LIMIT 1;
        
        IF free_plan_id IS NULL THEN
            -- Create a basic free plan if none exists
            INSERT INTO public.plans (
                name, description, price, max_stores, max_products, max_categories,
                features, is_active, is_free, level, currency, interval
            ) VALUES (
                'Gratuito', 'Plan gratuito básico', 0, 1, 10, 3,
                '["Catálogo básico", "1 tienda", "10 productos", "3 categorías"]'::jsonb,
                true, true, 1, 'usd', 'month'
            ) RETURNING id INTO free_plan_id;
        END IF;
        
        -- Assign the free plan to users without plans
        UPDATE public.users
        SET plan_uuid = free_plan_id
        WHERE plan_uuid IS NULL;
    END IF;
END $$;

-- Step 5: Drop the old column and rename the new one
ALTER TABLE public.users DROP COLUMN plan;
ALTER TABLE public.users RENAME COLUMN plan_uuid TO plan;

-- Step 6: Set NOT NULL constraint
ALTER TABLE public.users ALTER COLUMN plan SET NOT NULL;

-- Step 7: Add foreign key constraint
ALTER TABLE public.users 
ADD CONSTRAINT fk_users_plan 
FOREIGN KEY (plan) REFERENCES public.plans(id) ON DELETE RESTRICT;

-- Step 8: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_plan_uuid ON public.users(plan);

-- Step 9: Set default value to free plan UUID
ALTER TABLE public.users 
ALTER COLUMN plan SET DEFAULT (
  SELECT id FROM public.plans 
  WHERE is_free = true 
  ORDER BY level ASC 
  LIMIT 1
);

-- Step 10: Re-enable the trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'ensure_valid_user_plan_trigger' 
        AND tgrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users ENABLE TRIGGER ensure_valid_user_plan_trigger;
    END IF;
END $$;

-- Step 11: Update any existing user preferences that might reference old plan values
UPDATE public.user_preferences 
SET current_store_id = NULL 
WHERE current_store_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.stores 
    WHERE id = current_store_id 
    AND user_id = user_preferences.user_id
  );

COMMIT;