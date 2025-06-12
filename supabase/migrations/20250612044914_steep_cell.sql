-- Function to get plan by ID with UUID casting
CREATE OR REPLACE FUNCTION get_plan_by_id(plan_id text)
RETURNS TABLE(
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
  "interval" text,
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
    p."interval",
    p.created_at,
    p.updated_at
  FROM plans p
  WHERE p.id = plan_id::uuid;
END;
$$;

-- Function to get user by ID with UUID casting
CREATE OR REPLACE FUNCTION get_user_by_id(user_id text)
RETURNS TABLE(
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
  WHERE u.id = user_id::uuid;
END;
$$;

-- Function to update user plan with UUID casting
CREATE OR REPLACE FUNCTION update_user_plan(user_id text, new_plan_id text)
RETURNS TABLE(
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
  UPDATE users 
  SET 
    plan = new_plan_id,
    updated_at = now()
  WHERE users.id = user_id::uuid
  RETURNING 
    users.id,
    users.email,
    users.name,
    users.phone,
    users.bio,
    users.avatar,
    users.company,
    users.location,
    users.plan,
    users.subscription_id,
    users.subscription_status,
    users.subscription_start_date,
    users.subscription_end_date,
    users.subscription_canceled_at,
    users.payment_method,
    users.created_at,
    users.updated_at,
    users.is_active,
    users.stripe_customer_id;
END;
$$;

-- Function to insert system log with UUID casting
CREATE OR REPLACE FUNCTION insert_system_log(
  admin_id text,
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
    ip_address
  ) VALUES (
    admin_id::uuid,
    action,
    object_type,
    object_id,
    details,
    ip_address
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;