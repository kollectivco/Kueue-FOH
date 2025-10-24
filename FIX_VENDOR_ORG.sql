-- ============================================
-- Fix Vendor Organization Reference
-- ============================================
-- The vendor user is pointing to deleted demo org
-- Update it to point to the real Kueue organization
-- ============================================

BEGIN;

-- Get the real organization ID
-- Real org: 6036ea72-c873-456b-9040-bc1d2103556c

-- Update vendor user record
UPDATE kv_store_6eefa08e 
SET value = jsonb_set(
    value::jsonb,
    '{organization_id}',
    '"6036ea72-c873-456b-9040-bc1d2103556c"'::jsonb
)
WHERE key = 'user_vendor@restaurant.com';

-- Verify the update
SELECT 
    key,
    value::json->>'email' as email,
    value::json->>'role' as role,
    value::json->>'organization_id' as org_id
FROM kv_store_6eefa08e
WHERE key = 'user_vendor@restaurant.com';

-- Should show:
-- email: vendor@restaurant.com
-- role: vendor
-- org_id: 6036ea72-c873-456b-9040-bc1d2103556c

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- 1. Verify all users and their organizations
SELECT 
    key,
    value::json->>'email' as email,
    value::json->>'role' as role,
    value::json->>'organization_id' as org_id,
    CASE 
        WHEN value::json->>'organization_id' = '6036ea72-c873-456b-9040-bc1d2103556c' 
        THEN '✅ Valid Org'
        WHEN value::json->>'organization_id' IS NULL 
        THEN '✅ No Org (Admin)'
        ELSE '⚠️ Invalid Org'
    END as status
FROM kv_store_6eefa08e
WHERE key LIKE 'user_%'
ORDER BY role;

-- 2. Check organization exists
SELECT 
    'Organization Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM kv_store_6eefa08e 
            WHERE key = 'organization_6036ea72-c873-456b-9040-bc1d2103556c'
        ) THEN '✅ Organization Exists'
        ELSE '❌ Organization Missing'
    END as status;

-- 3. Final record count
SELECT 
    COUNT(*) as total_records,
    'Expected: 28 records' as note
FROM kv_store_6eefa08e;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '
    ╔══════════════════════════════════════════════════════════════╗
    ║  ✅ VENDOR ORGANIZATION FIX COMPLETE!                        ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                                                              ║
    ║  Updated:                                                    ║
    ║  • vendor@restaurant.com → Kueue Organization                ║
    ║                                                              ║
    ║  Next Steps:                                                 ║
    ║  1. Logout & Login as vendor                                 ║
    ║  2. Test Vendor Portal                                       ║
    ║  3. Verify organization appears correctly                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    ';
END $$;
