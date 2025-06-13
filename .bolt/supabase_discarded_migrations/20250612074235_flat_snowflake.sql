/*
  # Fix User Plan Column Type Migration

  This migration converts the users.plan column from text to UUID type
  while properly handling all dependent objects (triggers and views).

  ## Changes Made:
  1. Drop dependent triggers and views
  2. Migrate plan data from text to UUID
  3. Recreate column with proper UUID type
  4. Recreate all dependent objects
  5. Ensure data integrity throughout the process
*/

BEGIN;

-- Step 1: Drop dependent triggers first
DROP TRIGGER IF EXISTS handle_plan_upgrade_trigger ON public.users;
DROP TRIGGER IF EXISTS handle_plan_downgrade_trigger ON public.users;
DROP TRIGGER IF EXISTS ensure_valid_user_plan_trigger ON public.users;

-- Step 2: Drop dependent view
DROP VIEW IF EXISTS public.user_plan_details;

-- Step 3: Create a temporary column to store UUID values
ALTER TABLE public.users ADD COLUMN plan_uuid uuid;

-- Step 4: Migrate existing data
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

-- Step 5: Ensure all users have valid plan assignments
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

-- Step 6: Now safely drop the old column and rename the new one
ALTER TABLE public.users DROP COLUMN plan;
ALTER TABLE public.users RENAME COLUMN plan_uuid TO plan;

-- Step 7: Set NOT NULL constraint and add foreign key
ALTER TABLE public.users ALTER COLUMN plan SET NOT NULL;
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

-- Step 10: Recreate the user_plan_details view
CREATE VIEW public.user_plan_details AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.plan as plan_id,
    p.name as plan_name,
    p.level as plan_level,
    p.max_stores,
    p.max_products,
    p.max_categories,
    p.price as plan_price,
    p.is_free,
    u.subscription_status,
    u.subscription_start_date,
    u.subscription_end_date
FROM public.users u
LEFT JOIN public.plans p ON u.plan = p.id;

-- Step 11: Recreate the plan validation trigger function and trigger
CREATE OR REPLACE FUNCTION public.ensure_valid_user_plan()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the plan exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.plans 
        WHERE id = NEW.plan 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive plan: %', NEW.plan;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_valid_user_plan_trigger
    BEFORE INSERT OR UPDATE OF plan ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_valid_user_plan();

-- Step 12: Recreate the plan upgrade trigger function and trigger
CREATE OR REPLACE FUNCTION public.handle_plan_upgrade()
RETURNS TRIGGER AS $$
DECLARE
    old_plan_level integer;
    new_plan_level integer;
BEGIN
    -- Get plan levels
    SELECT level INTO old_plan_level FROM public.plans WHERE id = OLD.plan;
    SELECT level INTO new_plan_level FROM public.plans WHERE id = NEW.plan;
    
    -- If this is an upgrade (higher level), log it
    IF new_plan_level > old_plan_level THEN
        INSERT INTO public.system_logs (
            admin_id, action, object_type, object_id, details
        ) VALUES (
            NEW.id, 'plan_upgrade', 'user', NEW.id,
            jsonb_build_object(
                'old_plan', OLD.plan,
                'new_plan', NEW.plan,
                'old_level', old_plan_level,
                'new_level', new_plan_level
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_plan_upgrade_trigger
    AFTER UPDATE OF plan ON public.users
    FOR EACH ROW
    WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
    EXECUTE FUNCTION public.handle_plan_upgrade();

-- Step 13: Recreate the plan downgrade trigger function and trigger
CREATE OR REPLACE FUNCTION public.handle_plan_downgrade()
RETURNS TRIGGER AS $$
DECLARE
    old_plan_level integer;
    new_plan_level integer;
    user_stores_count integer;
    user_products_count integer;
    user_categories_count integer;
    new_plan_limits record;
BEGIN
    -- Get plan levels
    SELECT level INTO old_plan_level FROM public.plans WHERE id = OLD.plan;
    SELECT level INTO new_plan_level FROM public.plans WHERE id = NEW.plan;
    
    -- If this is a downgrade (lower level), check limits and clean up if necessary
    IF new_plan_level < old_plan_level THEN
        -- Get new plan limits
        SELECT max_stores, max_products, max_categories 
        INTO new_plan_limits
        FROM public.plans 
        WHERE id = NEW.plan;
        
        -- Count user's current usage
        SELECT COUNT(*) INTO user_stores_count
        FROM public.stores 
        WHERE user_id = NEW.id AND status = 'active';
        
        SELECT COUNT(*) INTO user_products_count
        FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE s.user_id = NEW.id AND p.is_active = true;
        
        SELECT COUNT(*) INTO user_categories_count
        FROM public.categories c
        JOIN public.stores s ON c.store_id = s.id
        WHERE s.user_id = NEW.id AND c.is_active = true;
        
        -- Suspend excess stores if over limit
        IF user_stores_count > new_plan_limits.max_stores THEN
            UPDATE public.stores 
            SET status = 'suspended'
            WHERE user_id = NEW.id 
            AND status = 'active'
            AND id NOT IN (
                SELECT id FROM public.stores 
                WHERE user_id = NEW.id AND status = 'active'
                ORDER BY created_at ASC
                LIMIT new_plan_limits.max_stores
            );
        END IF;
        
        -- Log the downgrade
        INSERT INTO public.system_logs (
            admin_id, action, object_type, object_id, details
        ) VALUES (
            NEW.id, 'plan_downgrade', 'user', NEW.id,
            jsonb_build_object(
                'old_plan', OLD.plan,
                'new_plan', NEW.plan,
                'old_level', old_plan_level,
                'new_level', new_plan_level,
                'stores_suspended', GREATEST(0, user_stores_count - new_plan_limits.max_stores)
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_plan_downgrade_trigger
    AFTER UPDATE OF plan ON public.users
    FOR EACH ROW
    WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
    EXECUTE FUNCTION public.handle_plan_downgrade();

-- Step 14: Update any existing user preferences that might reference invalid stores
UPDATE public.user_preferences 
SET current_store_id = NULL 
WHERE current_store_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.stores 
    WHERE id = current_store_id 
    AND user_id = user_preferences.user_id
  );

COMMIT;