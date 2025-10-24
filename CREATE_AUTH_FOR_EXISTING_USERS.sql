-- ===================================================
-- CREATE AUTH ACCOUNTS FOR EXISTING USERS
-- ===================================================
-- هذا السكريبت ينشئ auth accounts للمستخدمين
-- الموجودين في profiles فقط بدون auth
-- ===================================================

-- ⚠️ WARNING: This script creates auth accounts with temporary passwords
-- Users will need to reset their passwords after first login

-- ===================================================
-- OPTION 1: Create auth accounts with temporary password
-- ===================================================
-- Run this for each user that exists in profiles but not in auth.users

-- Example - Replace with actual user data:
/*
DO $$
DECLARE
    user_email TEXT := 'user@example.com'; -- ⚠️ REPLACE THIS
    user_name TEXT := 'User Name'; -- ⚠️ REPLACE THIS
    temp_password TEXT := 'TempPass123!'; -- ⚠️ REPLACE THIS
    user_id UUID;
BEGIN
    -- Create user in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        user_email,
        crypt(temp_password, gen_salt('bf')),
        NOW(), -- Auto-confirm email
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('name', user_name),
        NOW(),
        NOW(),
        '',
        ''
    )
    RETURNING id INTO user_id;

    -- Update profile with new auth user ID
    UPDATE profiles
    SET id = user_id,
        email = user_email,
        updated_at = NOW()
    WHERE email = user_email;

    RAISE NOTICE 'Created auth account for: % (ID: %)', user_email, user_id;
    RAISE NOTICE 'Temporary password: %', temp_password;
    RAISE NOTICE 'User should change password after first login!';
END $$;
*/

-- ===================================================
-- OPTION 2: Easier Method - Use Supabase Dashboard
-- ===================================================
-- This is the RECOMMENDED approach:

-- Step 1: Go to Supabase Dashboard → Authentication → Users
-- Step 2: For each user in profiles without auth:
--         a) Click "Add user"
--         b) Enter email from profiles table
--         c) Set a temporary password (user will change it)
--         d) Check "Auto Confirm Email"
--         e) Copy the generated User UUID
--         f) Update profiles table with this UUID

-- Example update query after creating user in dashboard:
/*
UPDATE profiles
SET id = 'PASTE_UUID_FROM_DASHBOARD_HERE' -- UUID from Supabase Dashboard
WHERE email = 'user@example.com';
*/

-- ===================================================
-- OPTION 3: Bulk Create (Advanced)
-- ===================================================
-- Create temporary passwords for all users without auth

DO $$
DECLARE
    profile_record RECORD;
    new_user_id UUID;
    temp_password TEXT;
BEGIN
    -- Loop through profiles without auth users
    FOR profile_record IN 
        SELECT p.id, p.email, p.name, p.role
        FROM profiles p
        LEFT JOIN auth.users u ON u.id = p.id
        WHERE u.id IS NULL AND p.email IS NOT NULL
    LOOP
        -- Generate temporary password
        temp_password := 'Temp' || substring(md5(random()::text) from 1 for 8) || '!';
        
        -- Create user (this requires SUPERUSER privileges)
        -- Note: This may not work in all Supabase setups
        -- Prefer using Supabase Dashboard or Admin API instead
        
        RAISE NOTICE '==================================';
        RAISE NOTICE 'User without auth account found:';
        RAISE NOTICE 'Email: %', profile_record.email;
        RAISE NOTICE 'Name: %', profile_record.name;
        RAISE NOTICE 'Role: %', profile_record.role;
        RAISE NOTICE 'Suggested temp password: %', temp_password;
        RAISE NOTICE 'ACTION NEEDED: Create this user via Supabase Dashboard';
        RAISE NOTICE '==================================';
    END LOOP;
    
    RAISE NOTICE 'Scan complete! Create users via Dashboard and update profile IDs.';
END $$;

-- ===================================================
-- OPTION 4: Using Supabase Admin API (from server)
-- ===================================================
-- This should be done from your Edge Function or backend:

/*
// In /supabase/functions/server/index.tsx or similar:

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Service role key required
);

async function createAuthForProfile(email: string, name: string, role: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: 'TemporaryPassword123!', // User should change this
    email_confirm: true, // Auto-confirm since we don't have email server
    user_metadata: {
      name: name,
      role: role
    }
  });
  
  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  
  // Update profile with new user ID
  await supabase
    .from('profiles')
    .update({ id: data.user.id })
    .eq('email', email);
  
  return data.user;
}
*/

-- ===================================================
-- VERIFICATION QUERIES
-- ===================================================

-- Check users that still need auth accounts
SELECT 
    p.email,
    p.name,
    p.role,
    'Needs auth account' as status
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- Check users ready to login
SELECT 
    u.email,
    p.name,
    p.role,
    'Ready to login ✅' as status
FROM auth.users u
INNER JOIN profiles p ON p.id = u.id
WHERE u.email_confirmed_at IS NOT NULL;

-- ===================================================
-- RECOMMENDED WORKFLOW:
-- ===================================================
-- 1. Run CHECK_CURRENT_USERS.sql to see who needs auth
-- 2. For each user without auth:
--    a) Go to Supabase Dashboard → Authentication → Users
--    b) Click "Add user"
--    c) Enter email and temporary password
--    d) Check "Auto Confirm Email"
--    e) Click "Create user"
--    f) Copy the User UUID
--    g) Run: UPDATE profiles SET id = 'UUID' WHERE email = 'email';
-- 3. Verify with CHECK_CURRENT_USERS.sql again
-- 4. Notify users of their temporary passwords
-- 5. Users change passwords on first login
-- ===================================================

-- Quick fix for specific user (template):
/*
-- Step 1: Create user in Supabase Dashboard
-- Step 2: Copy the UUID
-- Step 3: Update profile:

UPDATE profiles 
SET id = 'PASTE_UUID_HERE'
WHERE email = 'user@example.com';

-- Step 4: Verify:
SELECT u.email, p.name, p.role 
FROM auth.users u 
INNER JOIN profiles p ON p.id = u.id 
WHERE u.email = 'user@example.com';
*/
