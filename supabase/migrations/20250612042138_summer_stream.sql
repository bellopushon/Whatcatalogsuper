/*
  # Configuración completa de Stripe

  1. Nuevas Tablas
    - `stripe_config` - Configuración de API de Stripe
    - `stripe_products` - Productos sincronizados de Stripe
    - `stripe_prices` - Precios de productos de Stripe
    - `stripe_transactions` - Transacciones procesadas
    - `stripe_webhooks` - Log de webhooks recibidos

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas para super admin y acceso público según corresponda
    - Índices para optimización de consultas

  3. Funcionalidad
    - Triggers para updated_at automático
    - Referencias entre tablas con CASCADE apropiado
    - Validaciones de integridad de datos
*/

-- Tabla de configuración de Stripe
CREATE TABLE IF NOT EXISTS stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publishable_key text NOT NULL,
  secret_key text NOT NULL,
  webhook_secret text,
  is_live boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de productos de Stripe
CREATE TABLE IF NOT EXISTS stripe_products (
  id text PRIMARY KEY, -- Stripe product ID
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de precios de Stripe
CREATE TABLE IF NOT EXISTS stripe_prices (
  id text PRIMARY KEY, -- Stripe price ID
  product_id text NOT NULL REFERENCES stripe_products(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- Amount in cents
  currency text NOT NULL DEFAULT 'USD',
  interval text, -- 'month', 'year', etc. (null for one-time)
  interval_count integer DEFAULT 1,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de transacciones de Stripe
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id text PRIMARY KEY, -- Stripe payment intent ID
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customer_id text, -- Stripe customer ID
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL,
  payment_method text,
  product_id text REFERENCES stripe_products(id) ON DELETE SET NULL,
  price_id text REFERENCES stripe_prices(id) ON DELETE SET NULL,
  subscription_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de webhooks de Stripe
CREATE TABLE IF NOT EXISTS stripe_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed boolean DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE stripe_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhooks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Super admin can manage stripe config" ON stripe_config;
DROP POLICY IF EXISTS "Super admin can manage stripe products" ON stripe_products;
DROP POLICY IF EXISTS "Public can read active stripe products" ON stripe_products;
DROP POLICY IF EXISTS "Super admin can manage stripe prices" ON stripe_prices;
DROP POLICY IF EXISTS "Public can read active stripe prices" ON stripe_prices;
DROP POLICY IF EXISTS "Users can read own transactions" ON stripe_transactions;
DROP POLICY IF EXISTS "Super admin can manage all transactions" ON stripe_transactions;
DROP POLICY IF EXISTS "Super admin can manage stripe webhooks" ON stripe_webhooks;

-- Policies for stripe_config (only super admin)
CREATE POLICY "Super admin can manage stripe config"
  ON stripe_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

-- Policies for stripe_products (super admin can manage, public can read active)
CREATE POLICY "Super admin can manage stripe products"
  ON stripe_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

CREATE POLICY "Public can read active stripe products"
  ON stripe_products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Policies for stripe_prices (super admin can manage, public can read active)
CREATE POLICY "Super admin can manage stripe prices"
  ON stripe_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

CREATE POLICY "Public can read active stripe prices"
  ON stripe_prices
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Policies for stripe_transactions (users can see own, super admin can see all)
CREATE POLICY "Users can read own transactions"
  ON stripe_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admin can manage all transactions"
  ON stripe_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

-- Policies for stripe_webhooks (only super admin)
CREATE POLICY "Super admin can manage stripe webhooks"
  ON stripe_webhooks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_prices_product_id ON stripe_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_user_id ON stripe_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_status ON stripe_transactions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_created_at ON stripe_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_id ON stripe_webhooks(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_processed ON stripe_webhooks(processed);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_stripe_config_updated_at ON stripe_config;
DROP TRIGGER IF EXISTS update_stripe_products_updated_at ON stripe_products;
DROP TRIGGER IF EXISTS update_stripe_prices_updated_at ON stripe_prices;
DROP TRIGGER IF EXISTS update_stripe_transactions_updated_at ON stripe_transactions;

-- Triggers for updated_at
CREATE TRIGGER update_stripe_config_updated_at 
BEFORE UPDATE ON stripe_config 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_products_updated_at 
BEFORE UPDATE ON stripe_products 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_prices_updated_at 
BEFORE UPDATE ON stripe_prices 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_transactions_updated_at 
BEFORE UPDATE ON stripe_transactions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();