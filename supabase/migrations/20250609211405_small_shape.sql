/*
  # Fix Analytics Events Table Structure

  1. New Columns
    - `event_type` (analytics_event_type enum) - Type of analytics event
    - `session_id` (text) - Session identifier for tracking
    - `product_id` (uuid) - Reference to product for product_view events
    - `order_value` (numeric) - Value of order for order events
    - `customer_name` (text) - Customer name for order events
    - `order_items` (jsonb) - Order items details
    - `metadata` (jsonb) - Additional event metadata

  2. Constraints
    - Check constraint for positive order_value
    - Foreign key for product_id
    - NOT NULL constraint for event_type

  3. Indexes
    - Performance indexes for analytics queries
*/

-- Crear el tipo enum para event_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_type') THEN
    CREATE TYPE analytics_event_type AS ENUM ('visit', 'order', 'product_view');
  END IF;
END$$;

-- Añadir columnas faltantes a la tabla analytics_events
ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS event_type analytics_event_type,
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS product_id uuid,
ADD COLUMN IF NOT EXISTS order_value numeric(10,2),
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS order_items jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Actualizar la columna event_type para usar el nuevo tipo si ya existe pero es de otro tipo
DO $$
BEGIN
  -- Solo intentar cambiar el tipo si la columna existe y no es del tipo correcto
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

-- Añadir constraint para order_value (debe ser positivo o null) de forma segura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'analytics_events_order_value_check'
    AND table_name = 'analytics_events'
  ) THEN
    ALTER TABLE analytics_events
    ADD CONSTRAINT analytics_events_order_value_check 
    CHECK (order_value IS NULL OR order_value >= 0);
  END IF;
END$$;

-- Añadir foreign key para product_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'analytics_events_product_id_fkey'
    AND table_name = 'analytics_events'
  ) THEN
    ALTER TABLE analytics_events
    ADD CONSTRAINT analytics_events_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_store_id_created_at ON analytics_events(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Asegurar que event_type no sea null para nuevos registros (solo si la columna existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'event_type'
  ) THEN
    -- Primero actualizar valores NULL existentes con un valor por defecto
    UPDATE analytics_events 
    SET event_type = 'visit' 
    WHERE event_type IS NULL;
    
    -- Luego establecer la restricción NOT NULL
    ALTER TABLE analytics_events
    ALTER COLUMN event_type SET NOT NULL;
  END IF;
END$$;