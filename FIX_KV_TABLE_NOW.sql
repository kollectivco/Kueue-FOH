-- ===================================================
-- إصلاح جدول KV Store وإضافة الأعمدة المفقودة
-- ===================================================
-- نفذ هذا في Supabase SQL Editor
-- ===================================================

-- 1. حذف الجدول القديم إذا كان موجوداً (اختياري - احذف البيانات القديمة)
-- DROP TABLE IF EXISTS kv_store_6eefa08e CASCADE;

-- 2. إنشاء الجدول بالشكل الصحيح
CREATE TABLE IF NOT EXISTS kv_store_6eefa08e (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. إضافة الأعمدة إذا كان الجدول موجوداً بدونها
DO $$ 
BEGIN
  -- إضافة عمود created_at إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kv_store_6eefa08e' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE kv_store_6eefa08e 
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    RAISE NOTICE '✅ Added created_at column';
  ELSE
    RAISE NOTICE '✓ created_at column already exists';
  END IF;

  -- إضافة عمود updated_at إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kv_store_6eefa08e' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE kv_store_6eefa08e 
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    RAISE NOTICE '✅ Added updated_at column';
  ELSE
    RAISE NOTICE '✓ updated_at column already exists';
  END IF;
END $$;

-- 4. إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_kv_store_key 
  ON kv_store_6eefa08e(key);

CREATE INDEX IF NOT EXISTS idx_kv_store_key_pattern 
  ON kv_store_6eefa08e(key text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_kv_store_created_at 
  ON kv_store_6eefa08e(created_at);

-- 5. تفعيل RLS
ALTER TABLE kv_store_6eefa08e ENABLE ROW LEVEL SECURITY;

-- 6. إنشاء/تحديث Policies
DROP POLICY IF EXISTS "kv_service_role_all" ON kv_store_6eefa08e;
CREATE POLICY "kv_service_role_all"
  ON kv_store_6eefa08e FOR ALL
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "kv_authenticated_read" ON kv_store_6eefa08e;
CREATE POLICY "kv_authenticated_read"
  ON kv_store_6eefa08e FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kv_authenticated_insert" ON kv_store_6eefa08e;
CREATE POLICY "kv_authenticated_insert"
  ON kv_store_6eefa08e FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "kv_authenticated_update" ON kv_store_6eefa08e;
CREATE POLICY "kv_authenticated_update"
  ON kv_store_6eefa08e FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kv_authenticated_delete" ON kv_store_6eefa08e;
CREATE POLICY "kv_authenticated_delete"
  ON kv_store_6eefa08e FOR DELETE
  TO authenticated
  USING (true);

-- 7. إنشاء trigger function لتحديث updated_at
CREATE OR REPLACE FUNCTION update_kv_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. إنشاء الـ trigger
DROP TRIGGER IF EXISTS kv_store_updated_at_trigger ON kv_store_6eefa08e;
CREATE TRIGGER kv_store_updated_at_trigger
  BEFORE UPDATE ON kv_store_6eefa08e
  FOR EACH ROW
  EXECUTE FUNCTION update_kv_store_updated_at();

-- 9. عرض هيكل الجدول
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'kv_store_6eefa08e'
ORDER BY ordinal_position;

-- 10. التحقق من البيانات
SELECT 
  '✅ KV Store Table Fixed!' as status,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN key LIKE 'subscription_plan_%' THEN 1 END) as subscription_plans,
  COUNT(CASE WHEN key LIKE 'organization_%' THEN 1 END) as organizations
FROM kv_store_6eefa08e;

-- 11. اختبار الكتابة
INSERT INTO kv_store_6eefa08e (key, value) 
VALUES (
  'test_write_' || NOW()::text,
  jsonb_build_object(
    'test', true,
    'timestamp', NOW(),
    'status', 'success'
  )
)
RETURNING 
  key,
  value,
  created_at,
  updated_at;

-- 12. عرض آخر 5 سجلات
SELECT 
  key,
  value,
  created_at,
  updated_at
FROM kv_store_6eefa08e
ORDER BY created_at DESC
LIMIT 5;

-- 13. رسالة نهائية
SELECT '✅ All Done! Table is ready for use.' as message;
