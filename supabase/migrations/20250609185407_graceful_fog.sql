-- Crear el tipo enum para event_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_type') THEN
    CREATE TYPE analytics_event_type AS ENUM ('visit', 'order', 'product_view');
  END IF;
END$$;

-- Actualizar la tabla analytics_events
ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS event_type analytics_event_type,
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS order_value numeric(10,2),
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS order_items jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Actualizar la columna event_type para usar el nuevo tipo (solo si ya existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'event_type'
    AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE analytics_events
    ALTER COLUMN event_type TYPE analytics_event_type USING event_type::analytics_event_type;
  END IF;
END$$;

-- Añadir índices para mejorar el rendimiento (usando created_at en lugar de timestamp)
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_store_id_created_at ON analytics_events(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- Añadir restricción para order_value (debe ser positivo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'analytics_events_order_value_check'
  ) THEN
    ALTER TABLE analytics_events 
    ADD CONSTRAINT analytics_events_order_value_check 
    CHECK (order_value IS NULL OR order_value >= 0);
  END IF;
END$$;