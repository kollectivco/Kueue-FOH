-- ===================================================
-- CREATE KV STORE TABLE - SIMPLE VERSION
-- ===================================================
-- Run this in Supabase SQL Editor
-- ===================================================

-- Create table (with IF NOT EXISTS for safety)
CREATE TABLE IF NOT EXISTS kv_store_6eefa08e (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store_6eefa08e(key);
CREATE INDEX IF NOT EXISTS idx_kv_store_key_pattern ON kv_store_6eefa08e(key text_pattern_ops);

-- Enable RLS
ALTER TABLE kv_store_6eefa08e ENABLE ROW LEVEL SECURITY;

-- Drop old policies (if any)
DROP POLICY IF EXISTS "kv_authenticated_read" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "kv_authenticated_insert" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "kv_authenticated_update" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "kv_authenticated_delete" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "kv_service_role_all" ON kv_store_6eefa08e;

-- Create new policies
CREATE POLICY "kv_authenticated_read"
  ON kv_store_6eefa08e FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "kv_authenticated_insert"
  ON kv_store_6eefa08e FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "kv_authenticated_update"
  ON kv_store_6eefa08e FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "kv_authenticated_delete"
  ON kv_store_6eefa08e FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "kv_service_role_all"
  ON kv_store_6eefa08e FOR ALL
  TO service_role
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_kv_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS kv_store_updated_at_trigger ON kv_store_6eefa08e;
CREATE TRIGGER kv_store_updated_at_trigger
  BEFORE UPDATE ON kv_store_6eefa08e
  FOR EACH ROW
  EXECUTE FUNCTION update_kv_store_updated_at();

-- Verify
SELECT 
  '✅ KV Store Created!' as status,
  COUNT(*) as row_count
FROM kv_store_6eefa08e;
