-- ============================================
-- Cleanup Script: Remove Legacy Organization References
-- ============================================
-- Purpose: Clean up profiles with invalid organization_id references
-- Use Case: After UUID fix, remove references to non-UUID org IDs
-- 
-- ⚠️ WARNING: This will set organization_id to NULL for affected users
-- Run this only if you want to clean up legacy references
-- ============================================

-- Step 1: Check how many profiles have NULL organization_id
SELECT 
  COUNT(*) as total_users_without_org,
  COUNT(DISTINCT role) as roles_affected
FROM profiles
WHERE organization_id IS NULL;

-- Step 2: List affected users (for review)
SELECT 
  id,
  email,
  name,
  role,
  organization_id,
  created_at
FROM profiles
WHERE organization_id IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- Step 3: Get count of users per role without organization
SELECT 
  role,
  COUNT(*) as count
FROM profiles
WHERE organization_id IS NULL
GROUP BY role
ORDER BY count DESC;

-- ============================================
-- Manual Assignment Helper Query
-- ============================================
-- Use this to find valid organization UUIDs that you can assign

SELECT 
  id,
  name,
  email,
  status,
  created_at
FROM organizations
WHERE status = 'active'
ORDER BY created_at DESC;

-- ============================================
-- Bulk Assignment Example (UPDATE THIS!)
-- ============================================
-- Example: Assign all vendor users without org to a specific org

-- UNCOMMENT AND UPDATE THE UUID BELOW:
-- UPDATE profiles
-- SET organization_id = '550e8400-e29b-41d4-a716-446655440000'  -- Replace with real org UUID
-- WHERE role = 'vendor' 
-- AND organization_id IS NULL
-- RETURNING id, email, name;

-- ============================================
-- Verification Queries
-- ============================================

-- Check all users with their organizations
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  p.organization_id,
  o.name as org_name,
  o.status as org_status
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY p.created_at DESC
LIMIT 100;

-- Count valid vs invalid organization references
SELECT 
  CASE 
    WHEN organization_id IS NULL THEN 'No Organization'
    WHEN o.id IS NOT NULL THEN 'Valid Organization'
    ELSE 'Invalid Reference (orphaned)'
  END as org_status,
  COUNT(*) as count
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
GROUP BY 
  CASE 
    WHEN organization_id IS NULL THEN 'No Organization'
    WHEN o.id IS NOT NULL THEN 'Valid Organization'
    ELSE 'Invalid Reference (orphaned)'
  END;

-- ============================================
-- Notes:
-- ============================================
-- 1. After the UUID fix, new users will be created with valid UUIDs
-- 2. Old organizations with custom IDs won't break anything
-- 3. Users created with invalid org IDs will have NULL organization_id
-- 4. You can manually assign them later using the UPDATE query above
-- 5. This is safe - NULL organization_id is handled gracefully in the app
-- ============================================
