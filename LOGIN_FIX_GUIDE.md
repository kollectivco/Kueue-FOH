# Login Error Fix Guide - "Invalid Login Credentials"

## Problem
When trying to sign in, you see the error:
```
❌ Supabase auth error: AuthApiError: Invalid login credentials
```

## Root Cause
No users exist in the Supabase Auth system. The platform needs at least one user to be created before you can sign in.

## Solutions (Choose One)

### Solution 1: First Time Setup (Easiest) ⭐ **RECOMMENDED**

This is the fastest way to get started:

1. On the login page, press **"d"** three times quickly
2. Developer Tools will appear
3. Click **"🚀 First Time Setup"**
4. Fill in the form:
   - **Name**: Super Admin
   - **Email**: admin@kueue.com
   - **Password**: admin123456 (minimum 8 characters)
5. Click **"Create Admin User"**
6. Wait for success message
7. Sign in with the credentials you just created

**Demo Credentials Created:**
- Email: admin@kueue.com
- Password: admin123456

### Solution 2: Create All Demo Users

Create multiple demo accounts at once:

1. Activate Developer Tools (press "d" 3 times)
2. Click **"🚀 First Time Setup"**
3. Click **"Create All Demo Users"**
4. This creates 4 accounts:
   - **Super Admin**: admin@kueue.com / admin123456
   - **Vendor**: vendor@restaurant.com / vendor123456
   - **Support**: support@kueue.com / support123456
   - **Developer**: developer@kueue.com / dev123456

### Solution 3: Use Setup Tools

1. Activate Developer Tools (press "d" 3 times)
2. Click **"Setup Tools"**
3. Click **"Run Authentication Tests"**
4. If tests fail, click **"Force Create Demo Users"**
5. Sign in with: admin@kueue.com / admin123456

### Solution 4: Manual SQL Creation (Advanced)

If you have direct database access:

```sql
-- Execute this in Supabase SQL Editor

-- 1. Create user in Auth
-- Go to Authentication > Users in Supabase Dashboard
-- Click "Add User" and enter:
-- Email: admin@kueue.com
-- Password: admin123456
-- User Metadata: {"name": "Super Admin", "role": "super_admin"}

-- 2. After creating the user, copy its UUID and use it here:
INSERT INTO profiles (id, email, name, role, status, email_verified)
VALUES (
  'USER_UUID_HERE',  -- Replace with actual UUID from Auth
  'admin@kueue.com',
  'Super Admin',
  'super_admin',
  'active',
  true
);
```

## Quick Tips

### 🔐 Default Login Credentials

After setup, use these credentials:
- **Email**: admin@kueue.com
- **Password**: admin123456

### ⚡ Quick Developer Mode Activation

- Press **"d"** three times quickly on login page
- Or fail login 3 times to auto-activate developer tools

### 📝 Remember Me Feature

- Enable "Remember Me" checkbox to save your email for next time

## Verification Steps

1. After creating the user, try signing in
2. You should see: "Signed in successfully! 🎉"
3. You'll be redirected to the appropriate portal based on your role

## Troubleshooting

### If the problem persists:

#### 1. **Check Credentials**
- Email must be valid format
- Password must be at least 8 characters
- Check for typos

#### 2. **Clear Cache**
- Open Developer Tools
- Click "🗑️ Clear Storage"
- Reload the page

#### 3. **Check Internet Connection**
- Open Developer Tools
- Click "Diagnostics"
- Verify Supabase connection status

#### 4. **Check Browser Console**
- Open Developer Console (F12)
- Look for error messages in red
- Check Network tab for failed requests

#### 5. **Try Different Browser**
- Sometimes cache issues persist
- Try incognito/private mode
- Try a different browser

### Common Error Messages

| Error | Solution |
|-------|----------|
| "Invalid login credentials" | User doesn't exist - use First Time Setup |
| "Email not confirmed" | Use direct Supabase signup or SQL setup |
| "User already exists" | User exists! Try signing in |
| "Network error" | Check internet connection and Supabase status |

## What Was Fixed

### ✅ Completed Fixes:
1. ✅ Replaced `property_id` with `vendor_id` in PropertyUsersManagement.tsx
2. ✅ Replaced `property_id` with `vendor_id` in properties-routes.tsx
3. ✅ Added FirstTimeSetup component for easy user creation
4. ✅ Improved error messages on login failure
5. ✅ Added hints for new users
6. ✅ Auto-activate Developer Mode after 3 failed login attempts
7. ✅ Added "Force Create Demo Users" button in QuickAuthTest

### Database Schema Updates:
- Profiles table now uses `vendor_id` instead of `property_id`
- Backward compatibility maintained for existing code
- Property portal fully functional with vendor system

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Login Page (App.tsx)            │
├─────────────────────────────────────────┤
│  1. User enters credentials             │
│  2. Supabase Auth verification          │
│  3. If fails → Show error + hints       │
│  4. After 3 failures → Auto-enable Dev  │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Developer Tools (devMode=true)       │
├─────────────────────────────────────────┤
│  • First Time Setup                     │
│  • Setup Tools (QuickAuthTest)          │
│  • Diagnostics                          │
│  • Clear Storage                        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    FirstTimeSetup Component             │
├─────────────────────────────────────────┤
│  1. Create single admin user            │
│  2. Create all demo users               │
│  3. Show success with credentials       │
└─────────────────────────────────────────┘
```

## Next Steps

After successfully logging in:

1. **Super Admin** → System Admin Portal
   - Manage properties
   - Manage packages
   - Manage users
   - View analytics

2. **Vendor** → Property Portal
   - Manage reservations
   - Digital menu
   - Guest management
   - Floor plans

3. **Support** → Support Portal
   - Handle tickets
   - View all properties
   - Assist customers

4. **Developer** → Developer Portal
   - Database diagnostics
   - Migration tools
   - System health

## Additional Resources

- `QUICK_FIXES_NOW.md` - Quick fixes reference
- `DATABASE_FIX_INSTRUCTIONS.md` - Database setup guide
- `PHASE_1_FIX_GUIDE.md` - Comprehensive fix guide
- `حل_مشكلة_تسجيل_الدخول.md` - Arabic version of this guide

## Support

If you're still experiencing issues:

1. Check the browser console for detailed errors
2. Verify Supabase project is active
3. Ensure environment variables are set correctly
4. Review the error logs in Supabase Dashboard

---

**Last Updated**: 2025-10-23  
**Status**: Fixed ✅  
**Version**: 1.0.0
