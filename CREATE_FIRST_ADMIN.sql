-- ===================================================
-- CREATE FIRST SUPER ADMIN USER
-- ===================================================
-- Use this script to create your first Super Admin
-- after removing all demo data
-- ===================================================

-- INSTRUCTIONS:
-- 1. First, create a user via Supabase Dashboard:
--    - Go to Authentication → Users
--    - Click "Add user"
--    - Enter email: your-email@company.com
--    - Enter password: your-secure-password
--    - Check "Auto Confirm Email"
--    - Click "Create user"
--    - Copy the User ID (UUID)
--
-- 2. Then run this script, replacing USER_UUID with the copied ID

-- ===================================================
-- REPLACE THIS WITH YOUR USER UUID
-- ===================================================
DO $$
DECLARE
    user_uuid UUID := 'PASTE_USER_UUID_HERE'; -- ⚠️ REPLACE THIS!
    user_name TEXT := 'Your Name'; -- ⚠️ REPLACE THIS!
    user_email TEXT := 'your-email@company.com'; -- ⚠️ REPLACE THIS!
BEGIN
    -- Check if user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
        RAISE EXCEPTION 'User UUID not found in auth.users. Please create user first via Supabase Dashboard.';
    END IF;
    
    -- Update or insert profile with super_admin role
    INSERT INTO profiles (id, role, organization_id, name, email, created_at, updated_at)
    VALUES (
        user_uuid,
        'super_admin',
        NULL, -- Super admins don't belong to a specific organization
        user_name,
        user_email,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin',
        organization_id = NULL,
        name = user_name,
        email = user_email,
        updated_at = NOW();
    
    RAISE NOTICE 'Super Admin created successfully!';
    RAISE NOTICE 'Email: %', user_email;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'You can now sign in with your credentials.';
END $$;

-- ===================================================
-- VERIFY ADMIN CREATION
-- ===================================================
SELECT 
    u.id,
    u.email as auth_email,
    p.name,
    p.role,
    p.organization_id,
    p.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.role = 'super_admin'
ORDER BY p.created_at DESC;

-- ===================================================
-- ALTERNATIVE: Create Admin for Existing User
-- ===================================================
-- If you already signed up via the Sign Up form,
-- use this to upgrade your account to super_admin:

-- UPDATE profiles 
-- SET role = 'super_admin',
--     organization_id = NULL
-- WHERE email = 'your-email@company.com';

-- ===================================================
-- EXAMPLE USAGE:
-- ===================================================
-- 1. Create user in Supabase Dashboard
-- 2. Get user UUID (example: 123e4567-e89b-12d3-a456-426614174000)
-- 3. Replace USER_UUID above with your actual UUID
-- 4. Replace user_name and user_email with your info
-- 5. Run this script in SQL Editor
-- 6. Sign in with your email/password
-- ===================================================
