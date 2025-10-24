-- ═══════════════════════════════════════════════════════════════════
-- 🔴 PHASE 1: CRITICAL DATABASE FIXES - Kueue RSVP Platform
-- ═══════════════════════════════════════════════════════════════════
-- التاريخ: 22 أكتوبر 2025
-- الوصف: إصلاح شامل لأخطاء قاعدة البيانات الحرجة
-- المدة المتوقعة: 2-3 دقائق
-- 
-- محتويات المرحلة:
--   ✅ إصلاح RLS Policies (Row Level Security)
--   ✅ مزامنة Auth Users مع Profiles
--   ✅ إنشاء Indexes للأداء
--   ✅ تفعيل Auto-sync Triggers
--   ✅ تنظيف Orphaned Users
-- 
-- IMPORTANT: قم بتنفيذ هذا الملف بالكامل في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- إعدادات SQL
SET statement_timeout = '10min';
SET lock_timeout = '5s';

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: إنشاء جدول Profiles إذا لم يكن موجوداً
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'vendor' CHECK (role IN (
    'vendor', 
    'support', 
    'super_admin', 
    'support_admin', 
    'billing_admin', 
    'developer'
  )),
  phone TEXT,
  organization_id UUID,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

COMMENT ON TABLE public.profiles IS 'User profiles synchronized with auth.users';
COMMENT ON COLUMN public.profiles.role IS 'User role: vendor, support, super_admin, support_admin, billing_admin, developer';
COMMENT ON COLUMN public.profiles.status IS 'User status: active, inactive, suspended';

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: إنشاء Helper Functions (بدون Recursion)
-- ═══════════════════════════════════════════════════════════════════

-- Function: الحصول على role المستخدم الحالي بدون recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    'vendor'
  );
$$;

COMMENT ON FUNCTION public.get_current_user_role() IS 'Returns current user role without RLS recursion - used in policies';

-- Function: التحقق من Admin privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'support_admin')
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Check if current user is an admin without RLS recursion';

-- Function: التحقق من Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'developer')
    LIMIT 1
  );
$$;

-- Function: تحديث timestamp automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 3: حذف جميع Policies القديمة (Clean Slate)
-- ═══════════════════════════════════════════════════════════════════

DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN
  RAISE NOTICE '🗑️ Dropping all existing RLS policies on profiles table...';
  
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' 
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles CASCADE', policy_record.policyname);
    RAISE NOTICE '  ✓ Dropped policy: %', policy_record.policyname;
  END LOOP;
  
  RAISE NOTICE '✅ All old policies dropped';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 4: تفعيل RLS وإنشاء Policies الجديدة
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

RAISE NOTICE '🔒 RLS enabled on profiles table';

-- Policy 1: SELECT - Everyone can view all profiles (for listings, assignments, etc.)
CREATE POLICY "profiles_select_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "profiles_select_all" ON public.profiles IS 'All authenticated users can view profiles';

-- Policy 2: INSERT - Users can create their own profile
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy 3: INSERT - Admins can create any profile
CREATE POLICY "profiles_insert_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

COMMENT ON POLICY "profiles_insert_admin" ON public.profiles IS 'Super admins can insert any profile';

-- Policy 4: UPDATE - Users can update their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 5: UPDATE - Admins can update all profiles
CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMENT ON POLICY "profiles_update_admin" ON public.profiles IS 'Admins can update any profile';

-- Policy 6: DELETE - Only super admins can delete
CREATE POLICY "profiles_delete_super_admin"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_super_admin());

COMMENT ON POLICY "profiles_delete_super_admin" ON public.profiles IS 'Only super admins can delete profiles';

-- ═══════════════════════════════════════════════════════════════════
-- PART 5: إنشاء Triggers
-- ═══════════════════════════════════════════════════════════════════

-- Trigger: Auto-update timestamp
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Auto-sync new auth users to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    role, 
    email_verified,
    status,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'role', 
      'vendor'
    ),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    'active',
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Auto-creates profile when new user signs up';

-- ═══════════════════════════════════════════════════════════════════
-- PART 6: مزامنة Auth Users الموجودة مع Profiles
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  synced_count INT := 0;
  total_auth_users INT;
  total_profiles INT;
BEGIN
  RAISE NOTICE '🔄 Syncing existing auth users to profiles...';
  
  -- Get counts before sync
  SELECT COUNT(*) INTO total_auth_users FROM auth.users;
  SELECT COUNT(*) INTO total_profiles FROM public.profiles;
  
  RAISE NOTICE '  📊 Before sync: % auth users, % profiles', total_auth_users, total_profiles;
  
  -- Insert missing profiles
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    role, 
    email_verified,
    status,
    created_at, 
    updated_at
  )
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data->>'name', 
      split_part(au.email, '@', 1)
    ) as name,
    COALESCE(
      au.raw_user_meta_data->>'role', 
      'vendor'
    ) as role,
    COALESCE(au.email_confirmed_at IS NOT NULL, false) as email_verified,
    'active' as status,
    au.created_at,
    NOW() as updated_at
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();
  
  GET DIAGNOSTICS synced_count = ROW_COUNT;
  
  -- Get counts after sync
  SELECT COUNT(*) INTO total_profiles FROM public.profiles;
  
  RAISE NOTICE '  ✅ Synced % new profiles', synced_count;
  RAISE NOTICE '  📊 After sync: % auth users, % profiles', total_auth_users, total_profiles;
  
  IF total_auth_users = total_profiles THEN
    RAISE NOTICE '  ✅ All auth users have profiles - SYNCED!';
  ELSE
    RAISE WARNING '  ⚠️ Mismatch detected: % auth users vs % profiles', total_auth_users, total_profiles;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 7: تنظيف Orphaned Profiles (اختياري)
-- ═══════════════════════════════════════════════════════════════════

-- حذف profiles التي ليس لها auth users
DO $$
DECLARE
  deleted_count INT := 0;
BEGIN
  RAISE NOTICE '🧹 Cleaning orphaned profiles (profiles without auth users)...';
  
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = p.id
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '  ✅ Deleted % orphaned profiles', deleted_count;
  ELSE
    RAISE NOTICE '  ✅ No orphaned profiles found';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- PART 8: التحقق النهائي والإحصائيات
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INT;
  auth_count INT;
  profile_count INT;
  admin_count INT;
  vendor_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '📊 PHASE 1 - VERIFICATION REPORT';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Check RLS
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'profiles' AND schemaname = 'public';
  
  RAISE NOTICE '🔒 RLS Status: %', CASE WHEN rls_enabled THEN '✅ ENABLED' ELSE '❌ DISABLED' END;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'profiles' AND schemaname = 'public';
  
  RAISE NOTICE '📋 Active Policies: % policies created', policy_count;
  
  -- User counts
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  RAISE NOTICE '👥 Total Users:';
  RAISE NOTICE '   - Auth Users: %', auth_count;
  RAISE NOTICE '   - Profiles: %', profile_count;
  RAISE NOTICE '   - Status: %', CASE WHEN auth_count = profile_count THEN '✅ SYNCED' ELSE '⚠️ MISMATCH' END;
  
  -- Role distribution
  SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE role IN ('super_admin', 'developer', 'support_admin', 'billing_admin');
  SELECT COUNT(*) INTO vendor_count FROM public.profiles WHERE role = 'vendor';
  
  RAISE NOTICE '🎭 Role Distribution:';
  RAISE NOTICE '   - Admins: %', admin_count;
  RAISE NOTICE '   - Vendors: %', vendor_count;
  RAISE NOTICE '   - Others: %', profile_count - admin_count - vendor_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ PHASE 1 COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Test user login';
  RAISE NOTICE '  2. Verify admin access to User Management';
  RAISE NOTICE '  3. Check Developer Portal diagnostics';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- DETAILED VERIFICATION QUERIES (للمراجعة اليدوية)
-- ═══════════════════════════════════════════════════════════════════

-- Query 1: List all created policies
SELECT 
  '📋 Active Policies' as section,
  policyname as policy_name,
  cmd as operation,
  CASE cmd
    WHEN 'SELECT' THEN '👁️ Read'
    WHEN 'UPDATE' THEN '✏️ Update'
    WHEN 'INSERT' THEN '➕ Create'
    WHEN 'DELETE' THEN '🗑️ Delete'
    ELSE cmd
  END as action,
  CASE 
    WHEN policyname LIKE '%admin%' THEN '👑 Admin Only'
    WHEN policyname LIKE '%own%' THEN '👤 Own Data'
    WHEN policyname LIKE '%all%' THEN '🌐 Everyone'
    ELSE '❓ Custom'
  END as access_level
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- Query 2: Check indexes
SELECT 
  '⚡ Performance Indexes' as section,
  indexname as index_name,
  indexdef as definition
FROM pg_indexes
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY indexname;

-- Query 3: Sample of synced users
SELECT 
  '👥 Sample Synced Users' as section,
  p.email,
  p.name,
  p.role,
  p.status,
  p.email_verified,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Synced'
    ELSE '❌ Orphaned'
  END as sync_status
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
ORDER BY p.created_at DESC
LIMIT 10;

-- Query 4: Helper functions test
SELECT 
  '🔧 Helper Functions Test' as section,
  public.get_current_user_role() as your_role,
  public.is_admin() as is_admin,
  public.is_super_admin() as is_super_admin;

-- ═══════════════════════════════════════════════════════════════════
-- END OF PHASE 1
-- ═══════════════════════════════════════════════════════════════════
