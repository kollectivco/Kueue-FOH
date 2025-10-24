# Database Health Diagnostic Guide

## Overview
The Database Health Diagnostic tool automatically checks your Supabase database for common issues and provides quick fixes with ready-to-use SQL scripts.

## Location
**Developer Portal** → **Database** → **Health Diagnostic** tab

## Features

### 🔍 Automatic Checks (5 Tests)
1. **Profiles Table** - Verifies table exists and is accessible
2. **RLS Enabled** - Checks Row Level Security status
3. **RLS Policies** - Validates security policies configuration
4. **User Permissions** - Ensures current user has proper access
5. **Database Connection** - Tests Supabase connectivity

### ✅ Status Indicators
- **Success** (Green) - No action needed
- **Warning** (Yellow) - Minor issue detected
- **Failed** (Red) - Action required
- **Pending** (Gray) - Cannot verify (usually auth-related)
- **Checking** (Blue) - Test in progress

### 🛠️ Quick Fix Workflow

When issues are detected, a 3-step guide appears:

#### Step 1: Copy SQL Fix
Choose from 4 pre-built SQL scripts:
- **RLS Fix** - Removes infinite recursion in policies
- **Sync Users** - Syncs auth.users with profiles table
- **Create Profiles Table** - Creates missing profiles table
- **Fix All Issues** - Comprehensive fix for all common problems

#### Step 2: Open Supabase Dashboard
Click "Open Supabase Dashboard" to access SQL Editor

#### Step 3: Run SQL & Verify
1. Paste the SQL in Supabase SQL Editor
2. Click "Run" to execute
3. Return to app and click "Re-check After Fix"

## Common Issues & Solutions

### Issue: "infinite recursion detected in policy for relation 'profiles'"
**Solution:** Run the **RLS Fix** SQL script
**Cause:** Recursive RLS policies that reference themselves

### Issue: "Table 'profiles' does not exist"
**Solution:** Run the **Create Profiles Table** SQL script
**Cause:** Missing profiles table in database

### Issue: "Profile not found"
**Solution:** Run the **Sync Users** SQL script
**Cause:** Auth users exist without corresponding profiles

### Issue: "Clipboard not available"
**Solution:** Use the "View SQL" button to see SQL in a modal
**Cause:** Browser security policy blocking clipboard access
**Workaround:** Manual copy with Ctrl+A then Ctrl+C

## SQL Scripts Details

### 1. RLS_FIX.sql
Removes problematic RLS policies and creates simple, non-recursive ones:
- Drops existing policies
- Creates new SELECT policy (public read)
- Creates UPDATE policy (user can update own profile)
- Creates INSERT policy (user can create own profile)
- Grants necessary permissions

### 2. SYNC_USERS.sql
Syncs auth.users with profiles table:
- Finds auth users without profiles
- Creates missing profile records
- Preserves existing data
- Sets default role to 'vendor'

### 3. CREATE_PROFILES_TABLE.sql
Creates complete profiles table structure:
- Creates table with all columns
- Sets up foreign key to auth.users
- Enables RLS
- Creates policies
- Creates indexes
- Grants permissions

### 4. FIX_ALL.sql
Comprehensive fix that combines all scripts:
- Fixes RLS policies
- Syncs users
- Grants permissions
- Creates indexes
- Complete database health restoration

## Troubleshooting

### Clipboard Issues
If you see "Clipboard not available" errors:
1. Click "View SQL" button instead
2. Use Ctrl+A (Select All) then Ctrl+C (Copy)
3. Or use the "Try Copy Again" button in the modal

### Permission Errors
If SQL scripts fail in Supabase:
1. Ensure you're using the SQL Editor (not API)
2. Check you're logged in as owner/admin
3. Try running scripts one at a time

### Tests Still Failing After Fix
1. Clear browser cache
2. Sign out and sign back in
3. Click "Re-check After Fix" button
4. Verify SQL actually ran in Supabase (check Logs tab)

## Best Practices

### When to Run Diagnostics
- After fresh Supabase project setup
- When seeing auth/profile errors
- After database schema changes
- Before deploying to production
- When debugging user login issues

### Safety
- All SQL scripts are idempotent (safe to run multiple times)
- Scripts use `IF NOT EXISTS` and `ON CONFLICT` clauses
- No data is deleted (only policies are recreated)
- Original auth.users table is never modified

### Performance
- Tests run in ~2-3 seconds
- No impact on production database
- Read-only checks (except during fixes)
- Minimal database queries

## Integration Notes

### Used By
- Developer Portal (primary interface)
- Can be embedded in other admin portals
- Useful during onboarding/setup

### Dependencies
- `/utils/clipboard.tsx` - Safe clipboard operations
- `/utils/supabase/client.tsx` - Supabase connection
- `sonner` - Toast notifications
- ShadCN UI components

### API Calls
None - uses direct Supabase client queries:
- `supabase.from('profiles').select()`
- `supabase.auth.getUser()`
- `supabase.from('kv_store_6eefa08e').select()`

## Support

For issues with Database Health Diagnostic:
1. Check browser console for errors
2. Verify Supabase credentials in `/utils/supabase/info.tsx`
3. Test database connection separately
4. Contact support with diagnostic results screenshot

---

**Last Updated:** January 2025
**Component:** `/components/DatabaseHealthDiagnostic.tsx`
**Author:** Kueue RSVP Platform Team
