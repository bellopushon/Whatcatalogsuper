/*
  # Fix Store Access Permissions for Plan Update Triggers

  1. Security Updates
    - Grant necessary permissions to service role for plan triggers
    - Update trigger functions to use proper security context
    - Add proper error handling for store operations

  2. Trigger Function Updates
    - Modify handle_plan_upgrade to use SECURITY DEFINER
    - Modify handle_plan_downgrade to use SECURITY DEFINER
    - Add proper error handling and logging
*/

-- First, let's update the handle_plan_upgrade function with proper security context
CREATE OR REPLACE FUNCTION handle_plan_upgrade()
RETURNS TRIGGER 
SECURITY DEFINER -- This allows the function to run with elevated privileges
SET search_path = public
AS $$
DECLARE
    old_plan_id text;
    new_plan_id text;
    max_stores integer;
    store_count integer;
    store_record record;
BEGIN
    -- Get the old and new plan IDs
    old_plan_id := OLD.plan;
    new_plan_id := NEW.plan;
    
    -- Only proceed if this is an upgrade
    IF old_plan_id = new_plan_id THEN
        RETURN NEW;
    END IF;
    
    -- Get the maximum stores allowed for the new plan
    SELECT max_stores INTO max_stores
    FROM plans
    WHERE id = new_plan_id;
    
    -- If plan not found, log and continue
    IF max_stores IS NULL THEN
        RAISE WARNING 'Plan % not found, skipping store reactivation', new_plan_id;
        RETURN NEW;
    END IF;
    
    -- Count current active stores
    SELECT COUNT(*) INTO store_count
    FROM stores
    WHERE user_id = NEW.id AND status = 'active';
    
    -- If we're under the limit, reactivate suspended stores
    IF store_count < max_stores THEN
        -- Get suspended stores ordered by creation date (oldest first)
        FOR store_record IN 
            SELECT id
            FROM stores
            WHERE user_id = NEW.id AND status = 'suspended'
            ORDER BY created_at ASC
        LOOP
            -- If we're still under the limit, reactivate the store
            IF store_count < max_stores THEN
                BEGIN
                    UPDATE stores
                    SET status = 'active', updated_at = now()
                    WHERE id = store_record.id;
                    
                    store_count := store_count + 1;
                EXCEPTION WHEN OTHERS THEN
                    -- Log the error but don't fail the entire transaction
                    RAISE WARNING 'Failed to reactivate store %: %', store_record.id, SQLERRM;
                END;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user plan update
    RAISE WARNING 'Error in handle_plan_upgrade for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the handle_plan_downgrade function with proper security context
CREATE OR REPLACE FUNCTION handle_plan_downgrade()
RETURNS TRIGGER 
SECURITY DEFINER -- This allows the function to run with elevated privileges
SET search_path = public
AS $$
DECLARE
    old_plan_id text;
    new_plan_id text;
    max_stores integer;
    store_count integer;
    store_record record;
BEGIN
    -- Get the old and new plan IDs
    old_plan_id := OLD.plan;
    new_plan_id := NEW.plan;
    
    -- Only proceed if this is a downgrade
    IF old_plan_id = new_plan_id THEN
        RETURN NEW;
    END IF;
    
    -- Get the maximum stores allowed for the new plan
    SELECT max_stores INTO max_stores
    FROM plans
    WHERE id = new_plan_id;
    
    -- If plan not found, log and continue
    IF max_stores IS NULL THEN
        RAISE WARNING 'Plan % not found, skipping store suspension', new_plan_id;
        RETURN NEW;
    END IF;
    
    -- Count current active stores
    SELECT COUNT(*) INTO store_count
    FROM stores
    WHERE user_id = NEW.id AND status = 'active';
    
    -- If we're over the limit, suspend excess stores
    IF store_count > max_stores THEN
        -- Get active stores ordered by creation date (newest first)
        FOR store_record IN 
            SELECT id
            FROM stores
            WHERE user_id = NEW.id AND status = 'active'
            ORDER BY created_at DESC
        LOOP
            -- If we're still over the limit, suspend the store
            IF store_count > max_stores THEN
                BEGIN
                    UPDATE stores
                    SET status = 'suspended', updated_at = now()
                    WHERE id = store_record.id;
                    
                    store_count := store_count - 1;
                EXCEPTION WHEN OTHERS THEN
                    -- Log the error but don't fail the entire transaction
                    RAISE WARNING 'Failed to suspend store %: %', store_record.id, SQLERRM;
                END;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user plan update
    RAISE WARNING 'Error in handle_plan_downgrade for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the ensure_valid_user_plan function with better error handling
CREATE OR REPLACE FUNCTION ensure_valid_user_plan()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    plan_exists boolean;
BEGIN
    -- Check if the plan exists
    SELECT EXISTS (
        SELECT 1 FROM plans WHERE id = NEW.plan AND is_active = true
    ) INTO plan_exists;
    
    -- If plan doesn't exist or is inactive, try to get the free plan
    IF NOT plan_exists THEN
        -- Try to get the free plan as fallback
        SELECT id INTO NEW.plan
        FROM plans
        WHERE is_free = true AND is_active = true
        LIMIT 1;
        
        -- If no free plan exists, raise an error
        IF NEW.plan IS NULL THEN
            RAISE EXCEPTION 'Invalid plan: % and no free plan available', OLD.plan;
        END IF;
        
        RAISE WARNING 'Plan % not found, assigned free plan % to user %', OLD.plan, NEW.plan, NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error validating user plan: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions to the service role for store operations
-- This ensures the triggers can access the stores table
GRANT SELECT, UPDATE ON stores TO service_role;
GRANT SELECT ON plans TO service_role;

-- Also grant to authenticated role for normal operations
GRANT SELECT ON plans TO authenticated;

-- Update RLS policies to allow service role access
-- Create a policy that allows service role to manage stores for plan operations
CREATE POLICY "Service role can manage stores for plan operations"
  ON stores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Recreate the triggers to ensure they use the updated functions
DROP TRIGGER IF EXISTS handle_plan_upgrade_trigger ON users;
CREATE TRIGGER handle_plan_upgrade_trigger
    AFTER UPDATE OF plan ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_plan_upgrade();

DROP TRIGGER IF EXISTS handle_plan_downgrade_trigger ON users;
CREATE TRIGGER handle_plan_downgrade_trigger
    AFTER UPDATE OF plan ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_plan_downgrade();

DROP TRIGGER IF EXISTS ensure_valid_user_plan_trigger ON users;
CREATE TRIGGER ensure_valid_user_plan_trigger
    BEFORE INSERT OR UPDATE OF plan ON users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_valid_user_plan();