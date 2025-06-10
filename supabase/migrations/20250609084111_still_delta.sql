/*
  # Update analytics events table structure

  1. Changes
    - Create analytics_event_type enum if not exists
    - Add new columns to analytics_events table
    - Update existing columns to use proper types
    - Add performance indexes

  2. Security
    - Maintain existing RLS policies
*/

-- Create enum type for event types if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_type') THEN
    CREATE TYPE analytics_event_type AS ENUM ('visit', 'order', 'product_view');
  END IF;
END$$;

-- Add new columns to analytics_events table if they don't exist
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS product_id uuid,
ADD COLUMN IF NOT EXISTS order_value numeric(10,2),
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS order_items jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Update the event_type column to use the enum type if it exists as text
DO $$
BEGIN
  -- Check if event_type column exists and is text type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'event_type' 
    AND data_type = 'text'
  ) THEN
    -- Update the column to use the enum type
    ALTER TABLE analytics_events 
    ALTER COLUMN event_type TYPE analytics_event_type 
    USING event_type::analytics_event_type;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'event_type'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE analytics_events 
    ADD COLUMN event_type analytics_event_type NOT NULL DEFAULT 'visit';
  END IF;
END$$;

-- Ensure created_at column exists (rename from timestamp if needed)
DO $$
BEGIN
  -- Check if timestamp column exists but created_at doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'timestamp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'created_at'
  ) THEN
    -- Rename timestamp to created_at
    ALTER TABLE analytics_events 
    RENAME COLUMN timestamp TO created_at;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analytics_events' 
    AND column_name = 'created_at'
  ) THEN
    -- Add created_at column if neither exists
    ALTER TABLE analytics_events 
    ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END$$;

-- Add foreign key constraint for product_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'analytics_events_product_id_fkey'
  ) THEN
    ALTER TABLE analytics_events 
    ADD CONSTRAINT analytics_events_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_store_id_created_at ON analytics_events(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- Update RLS policies to use correct column names
DROP POLICY IF EXISTS "Users can read analytics of own stores" ON analytics_events;
DROP POLICY IF EXISTS "Anyone can create analytics events" ON analytics_events;

-- Recreate policies with correct permissions
CREATE POLICY "Users can read analytics of own stores" 
ON analytics_events FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = analytics_events.store_id 
    AND stores.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can create analytics events" 
ON analytics_events FOR INSERT 
TO anon, authenticated
WITH CHECK (true);