-- ═══════════════════════════════════════════════════════════════════
-- تنظيف بيانات Subscription Plans من قاعدة البيانات
-- ═══════════════════════════════════════════════════════════════════
-- 
-- هذا النص SQL يحذف جميع بيانات Subscription Plans المتبقية
-- من KV store بعد حذف النظام من الواجهة الأمامية والخادم.
--
-- 📅 التاريخ: 2025-10-23
-- 🎯 الهدف: تنظيف شامل لبيانات Plans
-- ⚠️  تحذير: هذا الإجراء لا يمكن التراجع عنه!
--
-- ═══════════════════════════════════════════════════════════════════

-- 1️⃣ عرض جميع مفاتيح Plans الموجودة (للمراجعة فقط)
-- ═══════════════════════════════════════════════════════════════════
SELECT 
  key,
  LENGTH(value) as value_size_bytes,
  created_at,
  updated_at
FROM kv_store_6eefa08e 
WHERE key LIKE 'plan_%' 
   OR key LIKE 'subscription_plan_%'
   OR key LIKE '%_plan_%'
ORDER BY key;

-- 2️⃣ حساب عدد المفاتيح المراد حذفها
-- ═══════════════════════════════════════════════════════════════════
SELECT 
  CASE 
    WHEN key LIKE 'plan_%' THEN 'plan_prefix'
    WHEN key LIKE 'subscription_plan_%' THEN 'subscription_plan_prefix'
    ELSE 'other_plan_keys'
  END as key_type,
  COUNT(*) as count,
  SUM(LENGTH(value)) as total_size_bytes
FROM kv_store_6eefa08e 
WHERE key LIKE 'plan_%' 
   OR key LIKE 'subscription_plan_%'
GROUP BY key_type;

-- 3️⃣ حذف جميع مفاتيح Plans
-- ═══════════════════════════════════════════════════════════════════
-- ⚠️ تحذير: قم بفك التعليق عن الأسطر التالية لتنفيذ الحذف
-- ⚠️ تأكد من عمل backup قبل التنفيذ!

-- حذف plans مع البادئة plan_
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'plan_%';

-- حذف plans مع البادئة subscription_plan_
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'subscription_plan_%';

-- 4️⃣ التحقق من نجاح الحذف
-- ═══════════════════════════════════════════════════════════════════
-- تشغيل بعد الحذف للتأكد من عدم وجود مفاتيح plans متبقية

SELECT COUNT(*) as remaining_plan_keys
FROM kv_store_6eefa08e 
WHERE key LIKE 'plan_%' 
   OR key LIKE 'subscription_plan_%';

-- يجب أن تكون النتيجة: 0

-- 5️⃣ تنظيف audit logs المتعلقة بـ Plans (اختياري)
-- ═══════════════════════════════════════════════════════════════════
-- هذا اختياري - يمكنك الاحتفاظ بالـ audit logs للسجلات التاريخية

-- عرض audit logs المتعلقة بـ Plans
SELECT 
  key,
  value::json->>'action' as action,
  value::json->>'timestamp' as timestamp,
  value::json->>'payload' as payload
FROM kv_store_6eefa08e 
WHERE key LIKE 'audit_%'
  AND (
    value::json->>'action' LIKE '%plan%'
    OR value::json->>'action' = 'plan_created'
    OR value::json->>'action' = 'plan_updated'
    OR value::json->>'action' = 'plan_deleted'
  )
ORDER BY (value::json->>'timestamp') DESC
LIMIT 50;

-- حذف audit logs المتعلقة بـ Plans (فك التعليق إذا كنت تريد حذفها)
-- DELETE FROM kv_store_6eefa08e 
-- WHERE key LIKE 'audit_%'
--   AND (
--     value::json->>'action' = 'plan_created'
--     OR value::json->>'action' = 'plan_updated'
--     OR value::json->>'action' = 'plan_deleted'
--   );

-- 6️⃣ تقرير نهائي - حالة KV Store بعد التنظيف
-- ═══════════════════════════════════════════════════════════════════
SELECT 
  CASE 
    WHEN key LIKE 'organization_%' THEN 'Organizations'
    WHEN key LIKE 'user_profile_%' THEN 'User Profiles'
    WHEN key LIKE 'reservation_%' THEN 'Reservations'
    WHEN key LIKE 'guest_%' THEN 'Guests'
    WHEN key LIKE 'event_%' THEN 'Events'
    WHEN key LIKE 'menu_%' THEN 'Menus'
    WHEN key LIKE 'feature_flag_%' THEN 'Feature Flags'
    WHEN key LIKE 'integration_%' THEN 'Integrations'
    WHEN key LIKE 'billing_%' THEN 'Billing Records'
    WHEN key LIKE 'backup_%' THEN 'Backups'
    WHEN key LIKE 'audit_%' THEN 'Audit Logs'
    WHEN key LIKE 'plan_%' THEN '🚨 REMAINING PLANS (Should be 0!)'
    WHEN key LIKE 'subscription_plan_%' THEN '🚨 REMAINING LEGACY PLANS (Should be 0!)'
    ELSE 'Other'
  END as data_type,
  COUNT(*) as count,
  ROUND(SUM(LENGTH(value))::numeric / 1024, 2) as size_kb
FROM kv_store_6eefa08e 
GROUP BY data_type
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 📊 النتيجة المتوقعة بعد التنظيف:
-- ═══════════════════════════════════════════════════════════════════
--
-- ✅ 0 مفتاح مع plan_ prefix
-- ✅ 0 مفتاح مع subscription_plan_ prefix
-- ✅ Organizations, Users, Reservations وبقية البيانات سليمة
-- ✅ KV store نظيف ومنظم
--
-- ═══════════════════════════════════════════════════════════════════
-- 🎉 تم التنظيف بنجاح!
-- ═══════════════════════════════════════════════════════════════════
