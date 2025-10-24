-- Migration 002: Storage Bucket Setup
-- Creates storage buckets for file uploads

-- ============================================================
-- 1. Create storage bucket for organization assets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'make-6eefa08e-organizations',
  'make-6eefa08e-organizations',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Create storage bucket for menu items
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'make-6eefa08e-menu-items',
  'make-6eefa08e-menu-items',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Set up RLS policies for storage
-- ============================================================

-- Organizations bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload to organizations bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their organization files" ON storage.objects;

CREATE POLICY "Authenticated users can upload to organizations bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'make-6eefa08e-organizations');

CREATE POLICY "Authenticated users can view their organization files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'make-6eefa08e-organizations');

CREATE POLICY "Users can delete their organization files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'make-6eefa08e-organizations');

-- Menu items bucket policies (public readable)
DROP POLICY IF EXISTS "Anyone can view menu item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload menu item images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete menu item images" ON storage.objects;

CREATE POLICY "Anyone can view menu item images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'make-6eefa08e-menu-items');

CREATE POLICY "Authenticated users can upload menu item images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'make-6eefa08e-menu-items');

CREATE POLICY "Users can delete menu item images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'make-6eefa08e-menu-items');

-- Migration complete
SELECT 'Migration 002 completed successfully' AS status;
