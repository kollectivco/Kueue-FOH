-- ============================================
-- KUEUE RSVP: Clean All Demo Data
-- ============================================
-- This script removes ALL demo/sample data from KV store
-- while preserving real user accounts and system configuration
-- ============================================

-- 1. REMOVE DEMO TABLES (10 tables)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'table_demo_kueue_main_%';

-- 2. REMOVE DEMO ZONES (2 zones)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'zone_demo_kueue_main_%';

-- 3. REMOVE DEMO MENU ITEMS (5 items)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'menu_item_demo_kueue_main_%';

-- 4. REMOVE DEMO MENU CATEGORIES (3 categories)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'menu_cat_demo_kueue_main_%';

-- 5. REMOVE DEMO GUESTS (2 guests)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'guest_demo_kueue_main_%';

-- 6. REMOVE DEMO VENUE
DELETE FROM kv_store_6eefa08e 
WHERE key = 'venue_demo_kueue_main_main';

-- 7. REMOVE DEMO ORGANIZATION
DELETE FROM kv_store_6eefa08e 
WHERE key = 'org_demo_kueue_main';

-- 8. REMOVE DEMO MENU CATEGORIES (demo-org)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'category_demo-org_%';

-- 9. REMOVE DEMO MENU (demo-org)
DELETE FROM kv_store_6eefa08e 
WHERE key LIKE 'menu_demo-org_%';

-- 10. REMOVE MENU SEEDED FLAG
DELETE FROM kv_store_6eefa08e 
WHERE key = 'menu_seeded_demo-org';

-- 11. OPTIONAL: REMOVE DEMO USER ACCOUNTS (if you want fresh start)
-- Comment out these lines if you want to keep demo login accounts
DELETE FROM kv_store_6eefa08e 
WHERE key IN (
  'user_admin@kueue.com',
  'user_support@kueue.com',
  'user_billing@kueue.com',
  'user_vendor@restaurant.com'
);

-- 12. OPTIONAL: REMOVE SUBSCRIPTION PLANS (if you want to recreate them)
-- Comment out if you want to keep existing plans
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'plan_%';

-- 13. OPTIONAL: REMOVE INTEGRATIONS (if you want to reconfigure)
-- Comment out if you want to keep integration configs
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'integration_%';

-- 14. OPTIONAL: REMOVE GLOBAL SETTINGS (if you want to reset)
-- Comment out if you want to keep settings
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'global_setting_%';

-- 15. OPTIONAL: REMOVE FEATURE FLAGS (if you want to reset)
-- Comment out if you want to keep feature flags
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'feature_flag_%';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to see what's left after cleanup:
SELECT 
  CASE 
    WHEN key LIKE 'user_profile_%' THEN 'User Profile'
    WHEN key LIKE 'organization_%' THEN 'Real Organization'
    WHEN key LIKE 'branch_%' THEN 'Real Branch'
    WHEN key LIKE 'slot_%' THEN 'Real Slot'
    WHEN key LIKE 'audit_%' THEN 'Audit Log'
    WHEN key LIKE 'plan_%' THEN 'Subscription Plan'
    WHEN key LIKE 'integration_%' THEN 'Integration'
    WHEN key LIKE 'global_setting_%' THEN 'Global Setting'
    WHEN key LIKE 'feature_flag_%' THEN 'Feature Flag'
    WHEN key LIKE 'org_code_%' THEN 'Organization Code'
    WHEN key = 'system_initialized' THEN 'System Flag'
    ELSE 'Other'
  END as data_type,
  COUNT(*) as count
FROM kv_store_6eefa08e
GROUP BY data_type
ORDER BY count DESC;

-- ============================================
-- WHAT WILL REMAIN AFTER CLEANUP:
-- ============================================
-- ✅ User Profiles (3): admin, billing, support
-- ✅ Real Organization: Kueue (created by admin)
-- ✅ Real Branch: Main Branch
-- ✅ Real Slots: Lunch, Dinner, Late Night (3 slots)
-- ✅ Subscription Plans (3): Basic, Premium, Enterprise
-- ✅ Integrations (3): Stripe, Twilio, SendGrid
-- ✅ Global Settings (5): System settings
-- ✅ Feature Flags (2): Analytics, SMS
-- ✅ Audit Logs
-- ✅ System Flags

-- ============================================
-- TOTAL RECORDS TO BE DELETED: ~30 demo records
-- TOTAL RECORDS REMAINING: ~20 real records
-- ============================================
