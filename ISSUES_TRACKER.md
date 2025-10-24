# 🐛 Issues Tracker - Kueue RSVP Platform

## تاريخ آخر تحديث: 22 أكتوبر 2025

---

## 🔴 مشاكل حرجة (Critical) - الأولوية القصوى

### ISSUE-001: RLS Infinite Recursion ⚠️
- **الحالة**: 🔴 Open - حرج
- **الأولوية**: P0 - فوري
- **الفئة**: Database
- **الوصف**: سياسات RLS تحتوي على تكرار لا نهائي يمنع قراءة/كتابة جدول profiles
- **الأثر**: 
  - فشل تسجيل دخول المستخدمين الجدد
  - عدم القدرة على تحديث البروفايلات
  - أخطاء متكررة في console
- **الملفات المتأثرة**: 
  - قاعدة البيانات: `profiles` table
  - `/RLS_ERROR_COMPLETE_GUIDE.md`
  - `/URGENT_RLS_FIX_README.md`
- **الحل المقترح**: استخدام `/QUICK_FIXES_NOW.md` - الإصلاح 1
- **الوقت المتوقع**: 15 دقيقة
- **Assigned to**: Database Admin
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-002: Auth/Profiles Desync ⚠️
- **الحالة**: 🔴 Open - حرج
- **الأولوية**: P0 - فوري
- **الفئة**: Database / Authentication
- **الوصف**: مستخدمون في auth.users لكن بدون سجلات في profiles
- **الأثر**:
  - مستخدمون لا يستطيعون الدخول للنظام
  - بيانات profile مفقودة
  - أخطاء "Profile not found"
- **الملفات المتأثرة**:
  - `/SYNC_AUTH_PROFILES.sql`
  - `/SYNC_ORPHANED_AUTH_USERS.sql`
  - `components/AuthContext.tsx`
- **الحل المقترح**: إنشاء trigger تلقائي - `/QUICK_FIXES_NOW.md` - الإصلاح 2
- **الوقت المتوقع**: 10 دقائق
- **Assigned to**: Database Admin
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-003: Duplicate Subscription Plans ⚠️
- **الحالة**: 🔴 Open - حرج
- **الأولوية**: P1 - عالي
- **الفئة**: Data Integrity
- **الوصف**: خطط اشتراك مكررة في KV store (20+ خطة بدلاً من 4)
- **الأثر**:
  - تشويش في واجهة الإدارة
  - صعوبة في إدارة الخطط
  - بيانات غير متسقة
- **الملفات المتأثرة**:
  - `/CLEAN_DUPLICATE_PLANS.md`
  - `/supabase/functions/server/index.tsx` (endpoint cleanup)
  - `components/SubscriptionPlansManagement.tsx`
- **الحل المقترح**: استخدام `/admin/plans/cleanup` endpoint
- **الوقت المتوقع**: 5 دقائق
- **Assigned to**: Backend Developer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-004: Silent Error Suppression 🐛
- **الحالة**: 🟡 Open - متوسط
- **الأولوية**: P1 - عالي
- **الفئة**: Development / Debugging
- **الوصف**: إخفاء الأخطاء بشكل صامت يمنع اكتشاف المشاكل
- **الأثر**:
  - أخطاء مخفية لا تظهر
  - صعوبة في debugging
  - مشاكل قد لا يتم اكتشافها
- **الملفات المتأثرة**:
  - `App.tsx` (حوالي السطر 395)
- **الحل المقترح**: إزالة suppression في dev mode
- **الوقت المتوقع**: 10 دقائق
- **Assigned to**: Frontend Developer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

## 🟠 مشاكل عالية الأولوية (High Priority)

### ISSUE-005: Manual Routing System 🛣️
- **الحالة**: 🟡 Open - متوسط
- **الأولوية**: P1 - عالي
- **الفئة**: Architecture
- **الوصف**: استخدام window.location يدوياً بدلاً من React Router
- **الأثر**:
  - صعوبة في إدارة التنقل
  - عدم دعم navigation guards
  - memory leaks محتملة
  - لا يوجد lazy loading للصفحات
- **الملفات المتأثرة**:
  - `App.tsx` (window.navigateToEvent)
  - جميع المكونات التي تستخدم window.location
- **الحل المقترح**: تطبيق React Router v6
- **الوقت المتوقع**: 2-3 ساعات
- **Assigned to**: Frontend Lead
- **Dependencies**: لا يوجد
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-006: Nested Context Providers 🔀
- **الحالة**: 🟡 Open - متوسط
- **الأولوية**: P1 - عالي
- **الفئة**: Performance / Architecture
- **الوصف**: 6 context providers متداخلة تسبب re-renders غير ضرورية
- **الأثر**:
  - أداء بطيء
  - re-renders مفرطة
  - استهلاك ذاكرة عالي
  - صعوبة في debugging
- **الملفات المتأثرة**:
  - `App.tsx`
  - `components/AuthContext.tsx`
  - `components/DataContext.tsx`
  - `components/PortalContext.tsx`
  - `components/GlobalDataStore.tsx`
  - `components/RouterContext.tsx`
  - `components/DigitalMenuContext.tsx`
- **الحل المقترح**: دمج في AppDataProvider واحد
- **الوقت المتوقع**: 4-6 ساعات
- **Assigned to**: Frontend Architect
- **Dependencies**: ISSUE-005
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-007: No Code Splitting 📦
- **الحالة**: 🟡 Open - متوسط
- **الأولوية**: P1 - عالي
- **الفئة**: Performance
- **الوصف**: bundle size كبير (2.5MB) بدون code splitting
- **الأثر**:
  - initial load بطيء (3-4 ثواني)
  - تجربة مستخدم سيئة
  - استهلاك bandwidth عالي
- **الملفات المتأثرة**:
  - `App.tsx` (جميع الـ imports)
  - `components/VendorPortalView.tsx`
  - `components/SystemAdminPortalView.tsx`
  - وجميع البوابات الأخرى
- **الحل المقترح**: استخدام React.lazy و dynamic imports
- **الوقت المتوقع**: 3-4 ساعات
- **Assigned to**: Performance Engineer
- **Dependencies**: ISSUE-005
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-008: Duplicate Model Files 📄
- **الحالة**: 🟢 Open - منخفض (سهل الإصلاح)
- **الأولوية**: P2 - متوسط
- **الفئة**: Code Quality
- **الوصف**: ملفان model للـ Reservations (V1 و V2)
- **الأثر**:
  - تشويش في الكود
  - صعوبة الصيانة
  - احتمال استخدام النسخة الخاطئة
- **الملفات المتأثرة**:
  - `components/ReservationModel.tsx` (قديم)
  - `components/ReservationModelV2.tsx` (الحالي)
- **الحل المقترح**: حذف V1 والتأكد من استخدام V2
- **الوقت المتوقع**: 15 دقيقة
- **Assigned to**: Frontend Developer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

## 🟡 مشاكل متوسطة الأولوية (Medium Priority)

### ISSUE-009: TypeScript Any Types 📝
- **الحالة**: 🟡 Open
- **الأولوية**: P2 - متوسط
- **الفئة**: Code Quality / Type Safety
- **الوصف**: استخدام `any` في أماكن كثيرة بدلاً من types دقيقة
- **الأثر**:
  - فقدان type safety
  - أخطاء runtime محتملة
  - ضعف IntelliSense
- **أمثلة**:
  ```typescript
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  ```
- **الحل المقترح**: إنشاء interfaces دقيقة
- **الوقت المتوقع**: 6-8 ساعات
- **Assigned to**: TypeScript Specialist
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-010: Missing useEffect Dependencies ⚠️
- **الحالة**: 🟡 Open
- **الأولوية**: P2 - متوسط
- **الفئة**: Code Quality / Bugs
- **الوصف**: dependencies ناقصة في useEffect hooks
- **الأثر**:
  - stale closures
  - bugs خفية
  - سلوك غير متوقع
- **أمثلة**:
  ```typescript
  // في AuthContext.tsx
  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshSession(); // قد لا يكون محدث
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]); // ❌ ناقص refreshSession
  ```
- **الحل المقترح**: إضافة dependencies الصحيحة
- **الوقت المتوقع**: 3-4 ساعات
- **Assigned to**: Frontend Developer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-011: Disorganized SQL Files 📁
- **الحالة**: 🟡 Open
- **الأولوية**: P2 - متوسط
- **الفئة**: Organization
- **الوصف**: 30+ ملف SQL متناثرة في root directory
- **الأثر**:
  - صعوبة في إيجاد الملفات
  - عدم وضوح ما هو مستخدم
  - فوضى في المشروع
- **الملفات المتأثرة**: جميع ملفات .sql في root
- **الحل المقترح**: نقل إلى `/database` مع تنظيم
- **الوقت المتوقع**: 1-2 ساعة
- **Assigned to**: DevOps / Organization
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-012: No Performance Optimization 🐌
- **الحالة**: 🟡 Open
- **الأولوية**: P2 - متوسط
- **الفئة**: Performance
- **الوصف**: عدم استخدام React.memo, useMemo, useCallback
- **الأثر**:
  - re-renders غير ضرورية
  - أداء ضعيف في القوائم الطويلة
  - تجربة مستخدم بطيئة
- **المكونات المتأثرة**:
  - `VendorPortalView.tsx`
  - `SystemAdminPortalView.tsx`
  - `ReservationManager.tsx`
  - `GuestsManagement.tsx`
- **الحل المقترح**: إضافة memoization للمكونات الكبيرة
- **الوقت المتوقع**: 4-5 ساعات
- **Assigned to**: Performance Engineer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

## 🟢 مشاكل منخفضة الأولوية (Low Priority)

### ISSUE-013: No Unit Tests ✅
- **الحالة**: 🟢 Open
- **الأولوية**: P3 - منخفض
- **الفئة**: Testing
- **الوصف**: لا توجد unit tests (coverage 0%)
- **الأثر**:
  - رegressions محتملة
  - صعوبة في refactoring
  - ثقة منخفضة في التغييرات
- **الحل المقترح**: إضافة Vitest + Testing Library
- **الوقت المتوقع**: 10-15 ساعة (للاختبارات الأساسية)
- **Assigned to**: QA Engineer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-014: Missing JSDoc Documentation 📚
- **الحالة**: 🟢 Open
- **الأولوية**: P3 - منخفض
- **الفئة**: Documentation
- **الوصف**: لا توجد JSDoc comments للمكونات والوظائف
- **الأثر**:
  - صعوبة للمطورين الجدد
  - IntelliSense ضعيف
  - عدم وضوح الـ API
- **الحل المقترح**: إضافة JSDoc تدريجياً
- **الوقت المتوقع**: 8-10 ساعات
- **Assigned to**: Technical Writer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-015: No Error Monitoring 🔍
- **الحالة**: 🟢 Open
- **الأولوية**: P3 - منخفض
- **الفئة**: Monitoring
- **الوصف**: لا يوجد error tracking service (Sentry, etc)
- **الأثر**:
  - لا نعرف الأخطاء في production
  - صعوبة في debugging مشاكل المستخدمين
  - لا metrics للأخطاء
- **الحل المقترح**: تكامل Sentry
- **الوقت المتوقع**: 2-3 ساعات
- **Assigned to**: DevOps
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

### ISSUE-016: No Performance Monitoring 📊
- **الحالة**: 🟢 Open
- **الأولوية**: P3 - منخفض
- **الفئة**: Monitoring
- **الوصف**: لا يوجد performance monitoring (Web Vitals, etc)
- **الأثر**:
  - لا نعرف الأداء في production
  - صعوبة في تحديد bottlenecks
  - لا بيانات لتحسين الأداء
- **الحل المقترح**: إضافة web-vitals library
- **الوقت المتوقع**: 1-2 ساعة
- **Assigned to**: Performance Engineer
- **Created**: 2025-10-22
- **Updated**: 2025-10-22

---

## 📊 إحصائيات المشاكل

### حسب الحالة
- 🔴 Open Critical: 4
- 🟡 Open High: 4
- 🟡 Open Medium: 4
- 🟢 Open Low: 4
- **المجموع**: 16 مشكلة مفتوحة

### حسب الفئة
- Database: 2
- Architecture: 2
- Performance: 4
- Code Quality: 3
- Testing: 1
- Documentation: 1
- Monitoring: 2
- Organization: 1

### حسب الأولوية
- P0 (فوري): 2
- P1 (عالي): 5
- P2 (متوسط): 5
- P3 (منخفض): 4

### الوقت المقدر الإجمالي
- **الإصلاحات الحرجة**: ~30 دقيقة
- **الأولوية العالية**: ~15-20 ساعة
- **الأولوية المتوسطة**: ~22-29 ساعة
- **الأولوية المنخفضة**: ~21-30 ساعة
- **المجموع**: ~58-79 ساعة عمل

---

## 🎯 خطة الإصلاح المقترحة

### Sprint 1 (أسبوع 1): الحرج فقط
- [ ] ISSUE-001: RLS Fix
- [ ] ISSUE-002: Auth Sync
- [ ] ISSUE-003: Plans Cleanup
- [ ] ISSUE-004: Error Handling

**الوقت**: ~1 ساعة للحرجة + 10 ساعات للباقي = **11 ساعة**

### Sprint 2 (أسبوع 2): الأولوية العالية
- [ ] ISSUE-005: React Router
- [ ] ISSUE-006: Context Providers
- [ ] ISSUE-007: Code Splitting
- [ ] ISSUE-008: Duplicate Files

**الوقت**: ~15-20 ساعة

### Sprint 3 (أسبوع 3): الأولوية المتوسطة
- [ ] ISSUE-009: TypeScript Types
- [ ] ISSUE-010: useEffect Dependencies
- [ ] ISSUE-011: SQL Organization
- [ ] ISSUE-012: Performance Optimization

**الوقت**: ~22-29 ساعة

### Sprint 4 (أسبوع 4): التحسينات
- [ ] ISSUE-013: Unit Tests (أساسيات)
- [ ] ISSUE-014: JSDoc (للمكونات الرئيسية)
- [ ] ISSUE-015: Error Monitoring
- [ ] ISSUE-016: Performance Monitoring

**الوقت**: ~10-15 ساعة (للأساسيات فقط)

---

## 📝 ملاحظات

### معايير إغلاق المشكلة:
1. تم تطبيق الحل المقترح
2. تم اختبار الإصلاح
3. تم مراجعة الكود (code review)
4. تم توثيق التغيير
5. تم نشر التحديث

### قواعد الأولوية:
- **P0**: يوقف النظام أو يسبب فقدان بيانات
- **P1**: يؤثر بشكل كبير على الأداء أو تجربة المستخدم
- **P2**: يسبب إزعاج أو صعوبة في التطوير
- **P3**: تحسينات مستقبلية

---

**آخر تحديث**: 22 أكتوبر 2025
**المسؤول**: Development Team
**المراجعة التالية**: نهاية كل sprint
