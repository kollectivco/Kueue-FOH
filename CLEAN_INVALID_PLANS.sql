-- ========================================
-- Clean Invalid Plans from KV Store
-- ========================================
-- This script removes all invalid subscription plans
-- from the kv_store_6eefa08e table that have:
-- - Missing or empty names
-- - NaN or invalid prices
-- - Incomplete data structures
--
-- Run this to clean up the demo/invalid plans
-- that are showing as "$NaN/month" in the UI
-- ========================================

-- Delete all plans with invalid data from KV store
DELETE FROM public.kv_store_6eefa08e
WHERE key LIKE 'plan_%'
  AND (
    -- Plans with missing or empty names
    (value->>'name' IS NULL OR value->>'name' = '')
    OR
    -- Plans with invalid monthly price
    (value->>'priceMonth' IS NULL OR value->>'priceMonth' = '' OR value->>'priceMonth' = 'NaN')
    OR
    -- Plans with invalid yearly price  
    (value->>'priceYear' IS NULL OR value->>'priceYear' = '' OR value->>'priceYear' = 'NaN')
    OR
    -- Plans with missing status
    (value->>'status' IS NULL OR value->>'status' = '')
  );

-- Verify the cleanup
SELECT 
  COUNT(*) as remaining_plans_count,
  'After cleanup' as status
FROM public.kv_store_6eefa08e
WHERE key LIKE 'plan_%';

-- Show remaining valid plans (if any)
SELECT 
  key,
  value->>'name' as plan_name,
  value->>'priceMonth' as monthly_price,
  value->>'priceYear' as yearly_price,
  value->>'status' as status,
  value->>'category' as category
FROM public.kv_store_6eefa08e
WHERE key LIKE 'plan_%'
ORDER BY value->>'createdAt' DESC;

-- ========================================
-- Expected Result:
-- - All invalid/demo plans removed
-- - Only valid plans with proper pricing remain
-- - UI will show "No subscription plans yet" if empty
-- ========================================
