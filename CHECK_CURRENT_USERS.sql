-- ===================================================
-- CHECK CURRENT USERS - هل يقدروا يدخلوا؟
-- ===================================================
-- هذا السكريبت يفحص المستخدمين الموجودين ويتحقق
-- من إمكانية تسجيل دخولهم
-- ===================================================

-- 1️⃣ عرض جميع المستخدمين في auth.users (يقدروا يدخلوا)
SELECT 
    '🟢 CAN LOGIN - في auth.users' as status,
    u.id,
    u.email,
    u.created_at as auth_created,
    u.confirmed_at,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email Confirmed'
        ELSE '⚠️ Email Not Confirmed'
    END as email_status
FROM auth.users u
ORDER BY u.created_at DESC;

-- ===================================================

-- 2️⃣ عرض جميع المستخدمين في profiles مع auth status
SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.organization_id,
    p.created_at as profile_created,
    CASE 
        WHEN u.id IS NOT NULL THEN '🟢 يقدر يدخل'
        ELSE '🔴 ما يقدرش يدخل - محتاج auth user'
    END as login_status,
    CASE 
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NOT NULL THEN '✅ جاهز للدخول'
        WHEN u.id IS NOT NULL AND u.email_confirmed_at IS NULL THEN '⚠️ محتاج تأكيد email'
        ELSE '❌ محتاج إنشاء auth account'
    END as detailed_status,
    u.email as auth_email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;

-- ===================================================

-- 3️⃣ إحصائيات سريعة
SELECT 
    'Total Users Summary' as info,
    '===================' as separator;

SELECT 
    COUNT(*) FILTER (WHERE u.id IS NOT NULL) as users_can_login,
    COUNT(*) FILTER (WHERE u.id IS NULL) as users_cannot_login,
    COUNT(*) as total_profiles
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id;

-- ===================================================

-- 4️⃣ المستخدمين اللي ما يقدروش يدخلوا (في profiles بس، مش في auth)
SELECT 
    '🔴 CANNOT LOGIN - محتاجين auth account' as issue,
    p.id,
    p.name,
    p.email,
    p.role,
    'Run CREATE_AUTH_FOR_EXISTING_USERS.sql to fix' as solution
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- ===================================================

-- 5️⃣ المستخدمين في auth بدون profiles (محتاجين profiles)
SELECT 
    '⚠️ في auth بس - محتاجين profile' as issue,
    u.id,
    u.email,
    u.created_at,
    'Sign in will auto-create profile OR run manual fix' as solution
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ===================================================

-- 6️⃣ المستخدمين الجاهزين للدخول بالكامل
SELECT 
    '✅ READY TO LOGIN' as status,
    u.email,
    p.name,
    p.role,
    o.name as organization,
    p.created_at
FROM auth.users u
INNER JOIN profiles p ON p.id = u.id
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE u.email_confirmed_at IS NOT NULL
ORDER BY p.created_at DESC;

-- ===================================================

-- 7️⃣ فحص Organizations المربوطة
SELECT 
    'Organizations Status' as info,
    '=====================' as separator;

SELECT 
    o.id,
    o.name,
    o.slug,
    COUNT(DISTINCT p.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN p.id END) as users_can_login,
    o.created_at
FROM organizations o
LEFT JOIN profiles p ON p.organization_id = o.id
LEFT JOIN auth.users u ON u.id = p.id
GROUP BY o.id, o.name, o.slug, o.created_at
ORDER BY o.created_at DESC;

-- ===================================================
-- RESULTS INTERPRETATION:
-- ===================================================
-- 🟢 = يقدر يدخل (موجود في auth.users و profiles)
-- ⚠️ = محتاج تأكيد email
-- 🔴 = ما يقدرش يدخل (مش موجود في auth.users)
-- ✅ = جاهز بالكامل
-- ❌ = محتاج إصلاح
-- ===================================================
