/*
  # Create system logs table for super admin

  1. New Tables
    - `system_logs`
      - `id` (uuid, primary key)
      - `admin_id` (uuid, references users)
      - `action` (text)
      - `object_type` (text)
      - `object_id` (text)
      - `details` (jsonb)
      - `ip_address` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `system_logs` table
    - Add policy for super admin access only
*/

CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Only super admin can access system logs
CREATE POLICY "Super admin can manage system logs"
  ON system_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.email = 'the.genio27@gmail.com'
    )
  );

-- Add foreign key constraint
ALTER TABLE system_logs 
ADD CONSTRAINT system_logs_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_admin_id ON system_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);