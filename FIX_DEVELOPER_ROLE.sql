-- =====================================================================
-- Fix Developer User Role
-- =====================================================================
-- المشكلة: المستخدم developer له role = 'vendor' في قاعدة البيانات
-- الحل: تغيير role إلى 'developer'
-- =====================================================================

-- Method 1: Fix by email (if you know the email)
UPDATE public.profiles
SET role = 'developer'
WHERE email LIKE '%developer%'
  OR name LIKE '%developer%';

-- Method 2: Fix by specific email
-- UPDATE public.profiles
-- SET role = 'developer'
-- WHERE email = 'your-developer-email@example.com';

-- Method 3: Find all users with 'developer' in name but wrong role
SELECT 
  id,
  email,
  name,
  role,
  'Should be developer' as note
FROM public.profiles
WHERE (email ILIKE '%developer%' OR name ILIKE '%developer%')
  AND role != 'developer';

-- Verify the change
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM public.profiles
WHERE role = 'developer'
ORDER BY created_at DESC;

-- =====================================================================
-- QUICK FIX: Update current user to developer role
-- =====================================================================
-- If you're currently logged in and want to fix YOUR account:

-- Option A: Find your account by email pattern
UPDATE public.profiles
SET role = 'developer'
WHERE email = (
  SELECT email 
  FROM public.profiles 
  WHERE email LIKE '%developer%' 
  LIMIT 1
);

-- Option B: Update the most recent 'vendor' with 'developer' in the name
UPDATE public.profiles
SET role = 'developer'
WHERE id = (
  SELECT id
  FROM public.profiles
  WHERE (name ILIKE '%developer%' OR email ILIKE '%developer%')
    AND role = 'vendor'
  ORDER BY created_at DESC
  LIMIT 1
);

-- SUCCESS! Now logout and login again to see Developer Portal
