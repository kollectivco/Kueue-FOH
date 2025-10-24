-- ============================================
-- KUEUE RSVP - Demo Data Cleanup Script
-- ============================================
-- Purpose: Remove demo restaurant data while keeping essential system configs
-- Safe to run: Yes - only removes demo data, keeps users and settings
-- Reversible: No - demo data will be permanently deleted
-- ============================================

-- Before running: BACKUP YOUR DATA
-- SELECT * FROM kv_store_6eefa08e;

BEGIN;

-- ============================================
-- SECTION 1: Remove Demo Menu Data (10 records)
-- ============================================

DELETE FROM kv_store_6eefa08e WHERE key = 'menu_demo-org_173590da-34f7-409c-bb6f-74c63ac54da0';
DELETE FROM kv_store_6eefa08e WHERE key = 'menu_seeded_demo-org';
DELETE FROM kv_store_6eefa08e WHERE key = 'category_demo-org_5b115566-7331-4dab-9e4d-f3733ae2ed69';
DELETE FROM kv_store_6eefa08e WHERE key = 'category_demo-org_7a6629ac-e464-4266-9113-7a40de96bc0e';
DELETE FROM kv_store_6eefa08e WHERE key = 'category_demo-org_a96512e3-6c91-4a7e-a139-eeb426ccc288';
DELETE FROM kv_store_6eefa08e WHERE key = 'category_demo-org_cbec6a3e-9e20-4fe4-8b77-7484d7422208';

DELETE FROM kv_store_6eefa08e WHERE key LIKE 'menu_item_demo_kueue_main_%';
DELETE FROM kv_store_6eefa08e WHERE key LIKE 'menu_cat_demo_kueue_main_%';

-- ============================================
-- SECTION 2: Remove Demo Floor Plan Data (12 records)
-- ============================================

DELETE FROM kv_store_6eefa08e WHERE key LIKE 'table_demo_kueue_main_%';
DELETE FROM kv_store_6eefa08e WHERE key LIKE 'zone_demo_kueue_main_%';
DELETE FROM kv_store_6eefa08e WHERE key = 'venue_demo_kueue_main_main';

-- ============================================
-- SECTION 3: Remove Demo Guest Data (2 records)
-- ============================================

DELETE FROM kv_store_6eefa08e WHERE key = 'guest_demo_kueue_main_john';
DELETE FROM kv_store_6eefa08e WHERE key = 'guest_demo_kueue_main_sarah';

-- ============================================
-- SECTION 4: Remove Demo Organization (1 record)
-- ============================================

DELETE FROM kv_store_6eefa08e WHERE key = 'org_demo_kueue_main';

-- ============================================
-- VERIFICATION: Check what remains
-- ============================================

-- Should have ~33 records remaining:
-- ✅ 8 user records (4 users + 4 profiles)
-- ✅ 8 system settings
-- ✅ 3 subscription plans
-- ✅ 3 integrations
-- ✅ 2 feature flags
-- ✅ 1 real organization (Kueue)
-- ✅ 3 time slots
-- ✅ 1 branch
-- ✅ 1 audit log
-- ✅ 2 org codes
-- ✅ 1 system_initialized flag

SELECT 
    COUNT(*) as remaining_records,
    'Expected: ~33 records' as note
FROM kv_store_6eefa08e;

-- Show categories of remaining records
SELECT 
    CASE 
        WHEN key LIKE 'user_%' THEN 'Users & Profiles'
        WHEN key LIKE 'plan_%' THEN 'Subscription Plans'
        WHEN key LIKE 'integration_%' THEN 'Integrations'
        WHEN key LIKE 'feature_flag_%' THEN 'Feature Flags'
        WHEN key LIKE 'global_setting_%' THEN 'Global Settings'
        WHEN key LIKE 'organization_%' THEN 'Organizations'
        WHEN key LIKE 'branch_%' THEN 'Branches'
        WHEN key LIKE 'slot_%' THEN 'Time Slots'
        WHEN key LIKE 'audit_%' THEN 'Audit Logs'
        WHEN key LIKE 'org_code_%' THEN 'Org Codes'
        WHEN key = 'system_initialized' THEN 'System Flags'
        ELSE 'Other'
    END as category,
    COUNT(*) as count
FROM kv_store_6eefa08e
GROUP BY category
ORDER BY count DESC;

-- Commit if everything looks good
COMMIT;

-- ============================================
-- POST-CLEANUP VERIFICATION
-- ============================================

-- Check remaining records detail
SELECT 
    key,
    CASE 
        WHEN key LIKE 'user_%' THEN '✅ Keep - User/Profile'
        WHEN key LIKE 'plan_%' THEN '✅ Keep - Subscription'
        WHEN key LIKE 'integration_%' THEN '✅ Keep - Integration'
        WHEN key LIKE 'feature_flag_%' THEN '✅ Keep - Feature Flag'
        WHEN key LIKE 'global_setting_%' THEN '✅ Keep - Setting'
        WHEN key LIKE 'organization_6036%' THEN '✅ Keep - Real Org'
        WHEN key LIKE 'branch_%' THEN '✅ Keep - Branch'
        WHEN key LIKE 'slot_%' THEN '✅ Keep - Slot'
        WHEN key LIKE 'audit_%' THEN '✅ Keep - Audit'
        WHEN key LIKE 'org_code_%' THEN '✅ Keep - Org Code'
        WHEN key = 'system_initialized' THEN '✅ Keep - System Flag'
        ELSE '⚠️ Review - Unknown'
    END as status,
    LENGTH(value) as value_size_bytes
FROM kv_store_6eefa08e
ORDER BY status, key;

-- ============================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================

-- If you need to rollback (before COMMIT):
-- ROLLBACK;

-- If you already committed and need demo data back:
-- You'll need to run the demo data seeding script again
-- Or restore from backup

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '
    ╔══════════════════════════════════════════════════════════════╗
    ║  ✅ CLEANUP COMPLETE!                                        ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Removed:                                                    ║
    ║  • 10 Demo Menu Records                                      ║
    ║  • 12 Demo Floor Plan Records                                ║
    ║  •  2 Demo Guest Records                                     ║
    ║  •  1 Demo Organization                                      ║
    ║  ─────────────────────────────────────────────────────────   ║
    ║  Total Removed: 25 demo records                              ║
    ║                                                              ║
    ║  Kept:                                                       ║
    ║  •  8 User & Profile Records                                 ║
    ║  •  8 System Settings                                        ║
    ║  •  3 Subscription Plans                                     ║
    ║  •  3 Integrations                                           ║
    ║  •  2 Feature Flags                                          ║
    ║  •  1 Real Organization (Kueue)                              ║
    ║  •  4 Branch/Slot Records                                    ║
    ║  •  2 System Flags                                           ║
    ║  ─────────────────────────────────────────────────────────   ║
    ║  Total Kept: ~33 essential records                           ║
    ║                                                              ║
    ║  Next Steps:                                                 ║
    ║  1. Refresh your application                                 ║
    ║  2. Test all 4 portals (admin, support, billing, vendor)     ║
    ║  3. Verify data appears correctly                            ║
    ║  4. Create your first real organization/venue                ║
    ╚══════════════════════════════════════════════════════════════╝
    ';
END $$;

-- ============================================
-- TESTING QUERIES
-- ============================================

-- Test 1: Verify users still exist
SELECT 
    key,
    value::json->>'email' as email,
    value::json->>'role' as role
FROM kv_store_6eefa08e
WHERE key LIKE 'user_%'
ORDER BY role;

-- Test 2: Verify subscription plans exist
SELECT 
    key,
    value::json->>'name' as plan_name,
    value::json->>'priceMonth' as monthly_price
FROM kv_store_6eefa08e
WHERE key LIKE 'plan_%'
ORDER BY monthly_price::int;

-- Test 3: Verify integrations exist
SELECT 
    key,
    value::json->>'name' as integration_name,
    value::json->>'type' as type,
    value::json->>'status' as status
FROM kv_store_6eefa08e
WHERE key LIKE 'integration_%';

-- Test 4: Verify no demo data remains
SELECT 
    COUNT(*) as demo_records_remaining,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Clean - No demo data'
        ELSE '⚠️ Warning - Demo data still exists'
    END as status
FROM kv_store_6eefa08e
WHERE key LIKE 'menu_%' 
   OR key LIKE 'table_%' 
   OR key LIKE 'zone_%' 
   OR key LIKE 'guest_%'
   OR key LIKE 'venue_%'
   OR key = 'org_demo_kueue_main';

-- ============================================
-- END OF SCRIPT
-- ============================================
