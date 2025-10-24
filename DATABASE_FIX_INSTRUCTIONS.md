# 🚨 Database RLS Fix Instructions

## Problem Overview

You're seeing these errors in the Database Health Diagnostic:

- ⚠️ **RLS Enabled**: Pending
- ⚠️ **User Permissions**: Warning - "User is not an admin" or "Profile not found"

### What's Happening?

The **Row Level Security (RLS)** policies on the `profiles` table have an **infinite recursion** issue:

```sql
-- ❌ BAD: This causes infinite recursion
CREATE POLICY "Check if admin" 
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles  -- ⚠️ Reading profiles while checking profiles policy!
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

When Postgres tries to check if you can read a profile:
1. It checks the RLS policy
2. The policy tries to read from `profiles` table
3. Which triggers the same RLS policy check
4. Which tries to read from `profiles` again
5. **→ Infinite loop!** 💥

---

## ✅ The Solution

We use a **Security Definer Function** that bypasses RLS safely:

```sql
-- ✅ GOOD: Function bypasses RLS
CREATE FUNCTION get_current_user_role()
RETURNS TEXT
SECURITY DEFINER  -- ⭐ This is the key!
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ✅ Policy uses the function (no recursion)
CREATE POLICY "profiles_select"
ON profiles FOR SELECT
USING (true);  -- Everyone can read

CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
USING (get_current_user_role() IN ('super_admin', 'developer'));
```

---

## 🔧 How to Fix

### Step 1: Copy the SQL

Click the **"✅ Copy Ultimate Fix"** button in the Developer Portal's Health Diagnostic tab.

Or manually copy from: `/ULTIMATE_FIX_PROFILES_RLS.sql`

### Step 2: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a **New Query**

### Step 3: Run the SQL

1. **Paste** the entire Ultimate Fix SQL
2. Click **"Run"**
3. Wait ~30 seconds for completion

### Step 4: Verify

Go back to Developer Portal → Health Diagnostic tab → Click **"Re-check"**

All checks should now be ✅ **GREEN**!

---

## 📊 What the Ultimate Fix Does

### 1. Creates Security Definer Function
```sql
CREATE FUNCTION get_current_user_role()
RETURNS TEXT
SECURITY DEFINER
```
This function can read `profiles` table **safely** without triggering RLS.

### 2. Drops All Existing Policies
Removes all old problematic policies that cause recursion.

### 3. Creates New RLS Policies (NO RECURSION)
- ✅ `profiles_select_all` - Everyone can view profiles
- ✅ `profiles_update_own` - Users can update their own profile
- ✅ `profiles_update_admin` - Admins can update all profiles (uses function!)
- ✅ `profiles_insert_own` - Users can create their profile
- ✅ `profiles_insert_admin` - Admins can create any profile

### 4. Syncs Auth Users to Profiles
Ensures every auth user has a corresponding profile record.

### 5. Creates Auto-Sync Trigger
Automatically creates profiles for new user signups.

---

## 🎯 Expected Results

After running the fix:

```
✅ Profiles Table: Success - Table exists and is accessible
✅ RLS Enabled: Pending - (Cannot verify directly, but policies work)
✅ RLS Policies: Success - RLS policies are working correctly
✅ User Permissions: Success - User profile exists (your_role)
✅ Database Connection: Success - Connected successfully (XXms)
```

---

## ❓ FAQ

### Q: Why can't I see my profile?
**A:** The RLS policies are blocking you. Run the Ultimate Fix SQL.

### Q: Why does "User Permissions" say "Warning"?
**A:** Either:
1. RLS policy is blocking the read (run Ultimate Fix)
2. Your profile doesn't exist (run Ultimate Fix - it syncs users)

### Q: Is this safe to run?
**A:** Yes! The script:
- Only affects the `profiles` table
- Does NOT delete any data
- Can be run multiple times safely
- Fixes broken RLS policies

### Q: What if I already have data?
**A:** The script preserves all existing data. It only:
- Replaces policies (not data)
- Syncs missing profiles (ON CONFLICT DO UPDATE)

### Q: Can I undo this?
**A:** Yes, but you'd need to:
1. Drop the new policies
2. Recreate your old policies
3. (But why would you? The old ones were broken!)

---

## 🆘 Still Having Issues?

If you still see errors after running the fix:

1. **Clear browser cache** and refresh
2. **Log out and log back in**
3. Check the **Supabase logs** for errors
4. Verify the SQL ran successfully (no red errors in SQL Editor)
5. Try running the **"Sync Users Only"** SQL separately

---

## 📝 Technical Details

### Why Security Definer Works

```sql
-- Regular policy (CAUSES RECURSION):
CREATE POLICY "check_admin" ON profiles
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  -- ↑ This SELECT triggers the same policy again!
);

-- Security Definer Function (NO RECURSION):
CREATE FUNCTION get_role() 
RETURNS TEXT 
SECURITY DEFINER  -- ⭐ Bypasses RLS!
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE POLICY "check_admin" ON profiles
USING (get_role() = 'admin');
-- ↑ Function is called, RLS is bypassed inside function
```

### RLS + Security Definer Flow

```
User tries to read profiles
    ↓
RLS checks policy
    ↓
Policy calls get_role() function
    ↓
Function executes with SECURITY DEFINER
    ↓
Function bypasses RLS (reads profiles directly)
    ↓
Function returns role
    ↓
Policy evaluates: role = 'admin' → true/false
    ↓
User can/cannot read profiles
```

No recursion because the function **skips the RLS check**!

---

## 🎉 Success!

Once fixed, you'll be able to:
- ✅ Read user profiles
- ✅ Update your own profile
- ✅ (If admin) Update other users' profiles
- ✅ Create new users via signup
- ✅ Manage users in Super Admin Portal

All without infinite recursion errors! 🚀
