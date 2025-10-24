-- ===================================================
-- CREATE KV STORE TABLE
-- ===================================================
-- Run this ONCE in Supabase SQL Editor
-- This table stores all application data in key-value format
-- ===================================================

CREATE TABLE IF NOT EXISTS kv_store_6eefa08e (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store_6eefa08e(key);

-- Create index for pattern matching (for getByPrefix)
CREATE INDEX IF NOT EXISTS idx_kv_store_key_pattern ON kv_store_6eefa08e(key text_pattern_ops);

-- Enable Row Level Security
ALTER TABLE kv_store_6eefa08e ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-run safety)
DROP POLICY IF EXISTS "Allow authenticated read access" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow authenticated update access" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow service role full access" ON kv_store_6eefa08e;

-- Policy: Allow authenticated users to read
CREATE POLICY "Allow authenticated read access"
  ON kv_store_6eefa08e
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert access"
  ON kv_store_6eefa08e
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update
CREATE POLICY "Allow authenticated update access"
  ON kv_store_6eefa08e
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete access"
  ON kv_store_6eefa08e
  FOR DELETE
  TO authenticated
  USING (true);

-- Policy: Allow service role full access
CREATE POLICY "Allow service role full access"
  ON kv_store_6eefa08e
  FOR ALL
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

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS kv_store_updated_at_trigger ON kv_store_6eefa08e;
CREATE TRIGGER kv_store_updated_at_trigger
  BEFORE UPDATE ON kv_store_6eefa08e
  FOR EACH ROW
  EXECUTE FUNCTION update_kv_store_updated_at();

-- Verify table creation
SELECT 
  '✅ KV Store Table Created Successfully!' as status,
  tablename,
  schemaname
FROM pg_tables 
WHERE tablename = 'kv_store_6eefa08e';

-- ===================================================
-- USAGE EXAMPLES
-- ===================================================

-- Insert a value
-- INSERT INTO kv_store_6eefa08e (key, value) 
-- VALUES ('test:key', '{"message": "Hello World"}'::jsonb);

-- Get a value
-- SELECT value FROM kv_store_6eefa08e WHERE key = 'test:key';

-- Update a value
-- UPDATE kv_store_6eefa08e 
-- SET value = '{"message": "Updated!"}'::jsonb 
-- WHERE key = 'test:key';

-- Delete a value
-- DELETE FROM kv_store_6eefa08e WHERE key = 'test:key';

-- Get all keys with a prefix
-- SELECT key, value FROM kv_store_6eefa08e 
-- WHERE key LIKE 'paymob:%';
