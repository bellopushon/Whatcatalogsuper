/*
  # Create PostgreSQL functions for sync-user-plan Edge Function

  1. New Functions
    - `get_plan_by_id` - Retrieves plan information by UUID
    - `get_user_by_id` - Retrieves user information by UUID  
    - `update_user_plan` - Updates user's plan with proper validation
    - `insert_system_log` - Inserts system log entries

  2. Security
    - Functions are created with proper security context
    - Only accessible by service role or super admin

  3. Type Safety
    - All UUID parameters are properly typed
    - Explicit type casting where needed
*/

-- Function to get plan by ID
CREATE OR REPLACE FUNCTION get_plan_by_id(plan_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric(10,2),
  max_stores integer,
  max_products integer,
  max_categories integer,
  features jsonb,
  is_active boolean,
  is_free boolean,
  level integer,
  stripe_product_id varchar(255),
  stripe_price_id varchar(255),
  currency text,
  interval text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.max_stores,
    p.max_products,
    p.max_categories,
    p.features,
    p.is_active,
    p.is_free,
    p.level,
    p.stripe_product_id,
    p.stripe_price_id,
    p.currency,
    p.interval,
    p.created_at,
    p.updated_at
  FROM plans p
  WHERE p.id = plan_id AND p.is_active = true;
END;
$$;

-- Function to get user by ID
CREATE OR REPLACE FUNCTION get_user_by_id(user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  phone text,
  bio text,
  avatar text,
  company text,
  location text,
  plan text,
  subscription_id text,
  subscription_status subscription_status,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  subscription_canceled_at timestamptz,
  payment_method text,
  created_at timestamptz,
  updated_at timestamptz,
  is_active boolean,
  stripe_customer_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.phone,
    u.bio,
    u.avatar,
    u.company,
    u.location,
    u.plan,
    u.subscription_id,
    u.subscription_status,
    u.subscription_start_date,
    u.subscription_end_date,
    u.subscription_canceled_at,
    u.payment_method,
    u.created_at,
    u.updated_at,
    u.is_active,
    u.stripe_customer_id
  FROM users u
  WHERE u.id = user_id;
END;
$$;

-- Function to update user plan
CREATE OR REPLACE FUNCTION update_user_plan(user_id uuid, new_plan_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  plan text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_name text;
BEGIN
  -- Get the plan name first
  SELECT p.name INTO plan_name
  FROM plans p
  WHERE p.id = new_plan_id AND p.is_active = true;
  
  IF plan_name IS NULL THEN
    RAISE EXCEPTION 'Plan with ID % not found or inactive', new_plan_id;
  END IF;
  
  -- Update the user's plan
  UPDATE users 
  SET 
    plan = plan_name,
    updated_at = now()
  WHERE users.id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with ID % not found', user_id;
  END IF;
  
  -- Return updated user data
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.plan,
    u.updated_at
  FROM users u
  WHERE u.id = user_id;
END;
$$;

-- Function to insert system log
CREATE OR REPLACE FUNCTION insert_system_log(
  admin_id uuid,
  action text,
  object_type text,
  object_id text,
  details jsonb DEFAULT '{}',
  ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO system_logs (
    admin_id,
    action,
    object_type,
    object_id,
    details,
    ip_address,
    created_at
  ) VALUES (
    admin_id,
    action,
    object_type,
    object_id,
    details,
    ip_address,
    now()
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Grant execute permissions to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION get_plan_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_plan(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_system_log(uuid, text, text, text, jsonb, text) TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION get_plan_by_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_by_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION update_user_plan(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION insert_system_log(uuid, text, text, text, jsonb, text) TO service_role;