/*
  # Complete Database Schema Setup

  1. Database Schema
    - Create all necessary types (with IF NOT EXISTS checks)
    - Create all tables with proper relationships
    - Set up Row Level Security policies
    - Add performance indexes
    - Create utility functions and triggers

  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for data access
    - Ensure proper user isolation

  3. Performance
    - Add indexes for common queries
    - Optimize for catalog public access
*/

-- Create types with IF NOT EXISTS equivalent (DROP and CREATE)
DO $$ BEGIN
    CREATE TYPE user_plan AS ENUM ('gratuito', 'emprendedor', 'profesional');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE analytics_event_type AS ENUM ('visit', 'order', 'product_view');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE theme_mode AS ENUM ('light', 'dark', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  bio text,
  avatar text,
  company text,
  location text,
  plan user_plan DEFAULT 'gratuito',
  subscription_id text,
  subscription_status subscription_status,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  subscription_canceled_at timestamptz,
  payment_method text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de tiendas
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo text,
  whatsapp text,
  currency text DEFAULT 'USD',
  heading_font text DEFAULT 'Inter',
  body_font text DEFAULT 'Inter',
  color_palette text DEFAULT 'predeterminado',
  border_radius integer DEFAULT 8,
  products_per_page integer DEFAULT 12,
  facebook_url text,
  instagram_url text,
  tiktok_url text,
  twitter_url text,
  show_social_in_catalog boolean DEFAULT true,
  accept_cash boolean DEFAULT true,
  accept_bank_transfer boolean DEFAULT false,
  bank_details text,
  allow_pickup boolean DEFAULT true,
  allow_delivery boolean DEFAULT false,
  delivery_cost numeric(10,2) DEFAULT 0,
  delivery_zone text,
  message_greeting text DEFAULT '¡Hola {storeName}!',
  message_introduction text DEFAULT 'Soy {customerName}.\nMe gustaría hacer el siguiente pedido:',
  message_closing text DEFAULT '¡Muchas gracias!',
  include_phone_in_message boolean DEFAULT true,
  include_comments_in_message boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, name)
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_description text,
  long_description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  main_image text,
  gallery jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de eventos de analítica
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type analytics_event_type NOT NULL,
  session_id text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  order_value numeric(10,2),
  customer_name text,
  order_items jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Tabla de preferencias de usuario
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  dark_mode_enabled boolean DEFAULT false,
  email_notifications boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  preferred_language text DEFAULT 'es',
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas para users
DROP POLICY IF EXISTS "Allow user to read own profile" ON users;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON users;

CREATE POLICY "Allow user to read own profile" ON users FOR SELECT TO public USING (auth.uid() = id);
CREATE POLICY "Enable insert access for authenticated users" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Enable read access for authenticated users" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Enable update access for authenticated users" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Políticas para stores
DROP POLICY IF EXISTS "Users can read own stores" ON stores;
DROP POLICY IF EXISTS "Users can create stores" ON stores;
DROP POLICY IF EXISTS "Users can update own stores" ON stores;
DROP POLICY IF EXISTS "Users can delete own stores" ON stores;
DROP POLICY IF EXISTS "Public can read stores for catalog" ON stores;

CREATE POLICY "Users can read own stores" ON stores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create stores" ON stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stores" ON stores FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stores" ON stores FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can read stores for catalog" ON stores FOR SELECT TO anon USING (true);

-- Políticas para categories
DROP POLICY IF EXISTS "Users can manage categories of own stores" ON categories;
DROP POLICY IF EXISTS "Public can read categories for catalog" ON categories;

CREATE POLICY "Users can manage categories of own stores" ON categories FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = categories.store_id 
    AND stores.user_id = auth.uid()
  )
);
CREATE POLICY "Public can read categories for catalog" ON categories FOR SELECT TO anon USING (true);

-- Políticas para products
DROP POLICY IF EXISTS "Users can manage products of own stores" ON products;
DROP POLICY IF EXISTS "Public can read active products for catalog" ON products;

CREATE POLICY "Users can manage products of own stores" ON products FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = products.store_id 
    AND stores.user_id = auth.uid()
  )
);
CREATE POLICY "Public can read active products for catalog" ON products FOR SELECT TO anon USING (is_active = true);

-- Políticas para analytics_events
DROP POLICY IF EXISTS "Users can read analytics of own stores" ON analytics_events;
DROP POLICY IF EXISTS "Anyone can create analytics events" ON analytics_events;

CREATE POLICY "Users can read analytics of own stores" ON analytics_events FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = analytics_events.store_id 
    AND stores.user_id = auth.uid()
  )
);
CREATE POLICY "Anyone can create analytics events" ON analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Políticas para user_preferences
DROP POLICY IF EXISTS "Enable read access for user preferences" ON user_preferences;
DROP POLICY IF EXISTS "Enable insert access for user preferences" ON user_preferences;
DROP POLICY IF EXISTS "Enable update access for user preferences" ON user_preferences;
DROP POLICY IF EXISTS "Enable delete access for user preferences" ON user_preferences;

CREATE POLICY "Enable read access for user preferences" ON user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Enable insert access for user preferences" ON user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update access for user preferences" ON user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable delete access for user preferences" ON user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_events_store_id ON analytics_events(store_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_store_id_created_at ON analytics_events(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_current_store_id ON user_preferences(current_store_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para validar límites de tiendas por plan
CREATE OR REPLACE FUNCTION validate_store_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_plan_type user_plan;
  store_count integer;
  max_stores integer;
BEGIN
  -- Obtener el plan del usuario
  SELECT plan INTO user_plan_type FROM users WHERE id = NEW.user_id;
  
  -- Contar tiendas existentes
  SELECT COUNT(*) INTO store_count FROM stores WHERE user_id = NEW.user_id;
  
  -- Determinar límite según el plan
  CASE user_plan_type
    WHEN 'gratuito' THEN max_stores := 1;
    WHEN 'emprendedor' THEN max_stores := 2;
    WHEN 'profesional' THEN max_stores := 5;
    ELSE max_stores := 1;
  END CASE;
  
  -- Validar límite
  IF store_count >= max_stores THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % tiendas para tu plan %', max_stores, user_plan_type;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para validar límites de productos por plan
CREATE OR REPLACE FUNCTION validate_product_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_plan_type user_plan;
  product_count integer;
  max_products integer;
BEGIN
  -- Obtener el plan del usuario a través de la tienda
  SELECT u.plan INTO user_plan_type 
  FROM users u 
  JOIN stores s ON s.user_id = u.id 
  WHERE s.id = NEW.store_id;
  
  -- Contar productos existentes en la tienda
  SELECT COUNT(*) INTO product_count FROM products WHERE store_id = NEW.store_id;
  
  -- Determinar límite según el plan
  CASE user_plan_type
    WHEN 'gratuito' THEN max_products := 10;
    WHEN 'emprendedor' THEN max_products := 30;
    WHEN 'profesional' THEN max_products := 50;
    ELSE max_products := 10;
  END CASE;
  
  -- Validar límite
  IF product_count >= max_products THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % productos para tu plan %', max_products, user_plan_type;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Función para validar límites de categorías por plan
CREATE OR REPLACE FUNCTION validate_category_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_plan_type user_plan;
  category_count integer;
  max_categories integer;
BEGIN
  -- Obtener el plan del usuario a través de la tienda
  SELECT u.plan INTO user_plan_type 
  FROM users u 
  JOIN stores s ON s.user_id = u.id 
  WHERE s.id = NEW.store_id;
  
  -- Contar categorías existentes en la tienda
  SELECT COUNT(*) INTO category_count FROM categories WHERE store_id = NEW.store_id;
  
  -- Determinar límite según el plan
  CASE user_plan_type
    WHEN 'gratuito' THEN max_categories := 3;
    WHEN 'emprendedor' THEN max_categories := 999999; -- Ilimitadas
    WHEN 'profesional' THEN max_categories := 999999; -- Ilimitadas
    ELSE max_categories := 3;
  END CASE;
  
  -- Validar límite solo si no es ilimitado
  IF max_categories < 999999 AND category_count >= max_categories THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % categorías para tu plan %', max_categories, user_plan_type;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers para validar límites
DROP TRIGGER IF EXISTS validate_store_limit_trigger ON stores;
DROP TRIGGER IF EXISTS validate_product_limit_trigger ON products;
DROP TRIGGER IF EXISTS validate_category_limit_trigger ON categories;

CREATE TRIGGER validate_store_limit_trigger BEFORE INSERT ON stores FOR EACH ROW EXECUTE FUNCTION validate_store_limit();
CREATE TRIGGER validate_product_limit_trigger BEFORE INSERT ON products FOR EACH ROW EXECUTE FUNCTION validate_product_limit();
CREATE TRIGGER validate_category_limit_trigger BEFORE INSERT ON categories FOR EACH ROW EXECUTE FUNCTION validate_category_limit();