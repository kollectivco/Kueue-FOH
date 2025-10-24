# 🚀 خطة العمل التفصيلية لإصلاح نظام Kueue RSVP

## 📅 الجدول الزمني
**مدة التنفيذ**: 4 أسابيع
**تاريخ البدء المقترح**: فور الموافقة
**تاريخ الانتهاء المتوقع**: 4 أسابيع من تاريخ البدء

---

## 🔴 المرحلة 1: الإصلاحات الحرجة (الأسبوع الأول)

### اليوم 1: إصلاح RLS Policies ⚡

#### الخطوة 1: تشخيص المشكلة الحالية
```bash
# في Supabase Dashboard > SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

#### الخطوة 2: تطبيق الإصلاح
```sql
-- ملف: /database/fixes/001_fix_rls_policies.sql

-- 1. حذف جميع السياسات الحالية
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 2. تعطيل RLS مؤقتاً للتأكد من عدم وجود سياسات
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. إعادة تفعيل RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. إنشاء سياسات بسيطة وآمنة
-- سياسة القراءة: الكل يستطيع القراءة (للبحث عن المستخدمين)
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  USING (true);

-- سياسة الإضافة: فقط للمستخدم نفسه
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- سياسة التحديث: فقط للمستخدم نفسه أو super_admin
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- سياسة الحذف: فقط super_admin
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );
```

#### الخطوة 3: اختبار الإصلاح
```sql
-- اختبار القراءة
SELECT COUNT(*) FROM profiles;

-- اختبار الكتابة (سيفشل إذا لم تكن مسجل دخول)
INSERT INTO profiles (id, email, name, role) 
VALUES ('test-id', 'test@test.com', 'Test', 'vendor');
```

#### الخطوة 4: التحقق من التطبيق
- تسجيل دخول
- التحقق من ظهور البيانات
- التحقق من إمكانية التحديث

---

### اليوم 2: إصلاح تزامن Auth/Profiles 🔄

#### الخطوة 1: إنشاء Trigger للتزامن التلقائي
```sql
-- ملف: /database/fixes/002_sync_auth_profiles.sql

-- 1. إنشاء function للتعامل مع المستخدمين الجدد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    status,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendor'),
    'active',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- 2. حذف trigger القديم إن وجد
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. إنشاء trigger جديد
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. مزامنة المستخدمين الحاليين (الذين بدون profiles)
INSERT INTO public.profiles (id, email, name, role, status, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ),
  COALESCE(au.raw_user_meta_data->>'role', 'vendor'),
  'active',
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. تحديث email_verified للمستخدمين الموجودين
UPDATE public.profiles p
SET 
  email_verified = (au.email_confirmed_at IS NOT NULL),
  updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id;
```

#### الخطوة 2: اختبار الـ Trigger
```sql
-- محاكاة إنشاء مستخدم جديد
-- (يجب تنفيذها من خلال Supabase Auth API)

-- التحقق من المزامنة
SELECT 
  au.id,
  au.email AS auth_email,
  p.email AS profile_email,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN 'Missing Profile ❌'
    ELSE 'Synced ✅'
  END AS sync_status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;
```

---

### اليوم 3: حذف الملفات والكود المكرر 🗑️

#### 1. حذف ReservationModel القديم
```bash
# في terminal
rm /components/ReservationModel.tsx
```

#### 2. تحديث الـ imports
```bash
# البحث عن جميع الملفات التي تستورد ReservationModel القديم
grep -r "from './ReservationModel'" components/
```

#### 3. استبدال ReservationModel بـ ReservationModelV2
في الملفات التي تستخدم `ReservationModel`:
```typescript
// قبل
import { ReservationModel } from './ReservationModel';

// بعد
import { ReservationModel } from './ReservationModelV2';
```

#### 4. نقل ملفات SQL إلى مجلد منظم
```bash
# إنشاء هيكل مجلدات
mkdir -p database/fixes
mkdir -p database/migrations
mkdir -p database/seeds
mkdir -p database/docs

# نقل الملفات
mv *.sql database/fixes/
mv database/schema.sql database/migrations/
```

---

### اليوم 4-5: دمج Context Providers 🔀

#### الخطوة 1: إنشاء AppDataProvider موحد
```typescript
// ملف جديد: /components/AppDataProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface AppDataContextType {
  // Portal State
  currentPortal: 'super_admin' | 'vendor' | 'support_admin' | 'billing_admin' | 'developer';
  switchPortal: (portal: string) => void;
  
  // Global Data
  organizations: Organization[];
  plans: Plan[];
  reservations: Reservation[];
  guests: Guest[];
  events: Event[];
  
  // Loading States
  loading: boolean;
  error: Error | null;
  
  // Data Operations
  refreshData: () => Promise<void>;
  
  // CRUD Operations (موحدة)
  createItem: <T>(type: string, data: T) => Promise<T>;
  updateItem: <T>(type: string, id: string, data: Partial<T>) => Promise<T>;
  deleteItem: (type: string, id: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [currentPortal, setCurrentPortal] = useState<string>('vendor');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // تحديد البوابة تلقائياً بناءً على دور المستخدم
  useEffect(() => {
    if (profile?.role) {
      setCurrentPortal(profile.role);
    }
  }, [profile]);
  
  // تحميل البيانات بناءً على البوابة الحالية
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, currentPortal]);
  
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // تحميل البيانات المناسبة للبوابة الحالية
      if (currentPortal === 'super_admin') {
        await loadAdminData();
      } else if (currentPortal === 'vendor') {
        await loadVendorData();
      }
      // ... إلخ
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };
  
  // ... باقي الوظائف
  
  return (
    <AppDataContext.Provider value={{
      currentPortal,
      switchPortal: setCurrentPortal,
      organizations,
      plans,
      loading,
      error,
      refreshData,
      // ... باقي القيم
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
```

#### الخطوة 2: تحديث App.tsx
```typescript
// في App.tsx
import { AppDataProvider } from './components/AppDataProvider';

function AppRouter() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppDataProvider>  {/* Provider واحد فقط */}
          <RouterProvider>
            <MainApp />
          </RouterProvider>
        </AppDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

#### الخطوة 3: حذف Providers القديمة
```bash
# بعد التأكد من نقل كل الوظائف
rm /components/GlobalDataStore.tsx
rm /components/DataContext.tsx
rm /components/PortalContext.tsx
```

---

### اليوم 6-7: تحسين Error Handling 🐛

#### الخطوة 1: إزالة Silent Error Suppression
```typescript
// في App.tsx - حذف/تعديل هذا الكود
useEffect(() => {
  // ❌ حذف كل هذا في dev mode
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment) {
    // لا تخفي أي أخطاء في dev mode
    return;
  }
  
  // في production، استخدام error monitoring
  const originalError = console.error;
  console.error = (...args) => {
    // أرسل إلى Sentry أو خدمة monitoring
    sendToErrorMonitoring(args);
    // اعرض الخطأ أيضاً
    originalError.apply(console, args);
  };
  
  return () => {
    console.error = originalError;
  };
}, []);
```

#### الخطوة 2: إضافة Error Monitoring (اختياري)
```bash
npm install @sentry/react
```

```typescript
// في App.tsx
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "YOUR_SENTRY_DSN",
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay()
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

---

## 🟠 المرحلة 2: تحسينات الأداء (الأسبوع الثاني)

### اليوم 8-9: تطبيق React Router 🛣️

#### الخطوة 1: تثبيت React Router
```bash
npm install react-router-dom
npm install -D @types/react-router-dom
```

#### الخطوة 2: إنشاء Router جديد
```typescript
// ملف جديد: /router/index.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy load المكونات الكبيرة
const MainApp = lazy(() => import('../App'));
const PublicEventApp = lazy(() => import('../components/PublicEventApp'));
const PublicMenuApp = lazy(() => import('../components/PublicMenuApp'));
const PublicFormApp = lazy(() => import('../components/PublicFormApp'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <MainApp />
      </Suspense>
    ),
  },
  {
    path: '/event/:slug',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <PublicEventApp />
      </Suspense>
    ),
  },
  {
    path: '/menu/:signature',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <PublicMenuApp />
      </Suspense>
    ),
  },
  {
    path: '/:vendor/:form',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <PublicFormApp />
      </Suspense>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

#### الخطوة 3: حذف الكود اليدوي
```typescript
// في App.tsx - حذف
window.navigateToEvent = (slug: string) => {
  // ...
};

// حذف جميع useEffect التي تتعامل مع window.location
```

---

### اليوم 10-11: Code Splitting 📦

#### الخطوة 1: تقسيم المكونات الكبيرة
```typescript
// في App.tsx
import { lazy, Suspense } from 'react';

// قبل: import مباشر
// import { VendorPortalView } from './components/VendorPortalView';

// بعد: lazy import
const VendorPortalView = lazy(() => 
  import('./components/VendorPortalView').then(m => ({ default: m.VendorPortalView }))
);
const SystemAdminPortalView = lazy(() => 
  import('./components/SystemAdminPortalView').then(m => ({ default: m.SystemAdminPortalView }))
);
const SupportAdminPortal = lazy(() => 
  import('./components/SupportAdminPortal').then(m => ({ default: m.SupportAdminPortal }))
);
const BillingAdminPortalReal = lazy(() => 
  import('./components/BillingAdminPortalReal').then(m => ({ default: m.BillingAdminPortalReal }))
);
const DeveloperPortal = lazy(() => 
  import('./components/DeveloperPortal').then(m => ({ default: m.DeveloperPortal }))
);

// في الاستخدام
function MainApp() {
  return (
    <Suspense fallback={<PortalLoadingScreen />}>
      {currentPortal === 'vendor' && <VendorPortalView />}
      {currentPortal === 'super_admin' && <SystemAdminPortalView />}
      {/* ... إلخ */}
    </Suspense>
  );
}
```

#### الخطوة 2: تحسين Bundle
```typescript
// في vite.config.ts (أو webpack.config.js)
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-portal': ['./components/VendorPortalView'],
          'admin-portal': ['./components/SystemAdminPortalView'],
          'support-portal': ['./components/SupportAdminPortal'],
          'billing-portal': ['./components/BillingAdminPortalReal'],
          'ui-components': ['./components/ui'],
        }
      }
    }
  }
});
```

---

### اليوم 12-13: React.memo و useMemo ⚡

#### الخطوة 1: تحسين VendorPortalView
```typescript
// في VendorPortalView.tsx
import { memo, useMemo, useCallback } from 'react';

export const VendorPortalView = memo(function VendorPortalView() {
  const { user, profile } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  
  // memoize الحسابات الثقيلة
  const dashboardStats = useMemo(() => {
    if (!dashboardData) return null;
    
    return {
      totalReservations: dashboardData.reservations.length,
      confirmedReservations: dashboardData.reservations.filter(r => r.status === 'confirmed').length,
      // ... باقي الحسابات
    };
  }, [dashboardData]);
  
  // memoize الوظائف
  const handleRefresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await fetchVendorDashboard();
      setDashboardData(data);
    } finally {
      setDataLoading(false);
    }
  }, []);
  
  // ...
});
```

#### الخطوة 2: تحسين قوائم البيانات الكبيرة
```typescript
// استخدام React Window للقوائم الطويلة
import { FixedSizeList as List } from 'react-window';

function ReservationsList({ reservations }) {
  const Row = useCallback(({ index, style }) => {
    const reservation = reservations[index];
    return (
      <div style={style}>
        <ReservationCard reservation={reservation} />
      </div>
    );
  }, [reservations]);
  
  return (
    <List
      height={600}
      itemCount={reservations.length}
      itemSize={100}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

---

### اليوم 14: اختبار وقياس الأداء 📊

```bash
# تثبيت أدوات القياس
npm install -D lighthouse webpack-bundle-analyzer

# تشغيل bundle analyzer
npm run build
npx webpack-bundle-analyzer dist/stats.json
```

---

## 🟡 المرحلة 3: تنظيف وتحسين الكود (الأسبوع الثالث)

### اليوم 15-16: تنظيم ملفات SQL 📁

```bash
# الهيكل الجديد
/database
  /migrations
    /001_initial_schema.sql
    /002_add_profiles_trigger.sql
    /003_fix_rls_policies.sql
  /seeds
    /001_default_plans.sql
    /002_demo_organizations.sql
  /fixes
    /archived
      /old_fix_files.sql
  /docs
    /schema_diagram.md
    /migration_guide.md
```

---

### اليوم 17-19: تحسين TypeScript Types 📝

```typescript
// إنشاء ملف: /types/index.ts
export interface User {
  id: string;
  email: string;
  user_metadata: {
    name?: string;
    role?: UserRole;
  };
}

export type UserRole = 'super_admin' | 'vendor' | 'support_admin' | 'billing_admin' | 'developer';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId?: string;
  createdAt: string;
  organization?: Organization;
}

// استبدال جميع any بـ types مناسبة
```

---

### اليوم 20-21: إضافة JSDoc والتوثيق 📚

```typescript
/**
 * VendorPortalView - البوابة الرئيسية للبائعين
 * 
 * @description
 * تعرض لوحة التحكم الخاصة بالبائع مع:
 * - إحصائيات الحجوزات
 * - إدارة الضيوف
 * - التقارير والتحليلات
 * 
 * @requires Feature: basic_dashboard (من خطة الاشتراك)
 * 
 * @example
 * ```tsx
 * <VendorPortalView />
 * ```
 */
export const VendorPortalView = memo(function VendorPortalView() {
  // ...
});
```

---

## 🟢 المرحلة 4: Monitoring والتطوير المستمر (الأسبوع الرابع)

### اليوم 22-23: تكامل Sentry 🔍

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// في main.tsx أو App.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  environment: import.meta.env.MODE,
});
```

---

### اليوم 24-25: Performance Monitoring 📈

```bash
npm install web-vitals
```

```typescript
// ملف جديد: /utils/performance.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initPerformanceMonitoring() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}
```

---

### اليوم 26-27: Unit Tests الأساسية ✅

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

```typescript
// ملف: /components/__tests__/AppDataProvider.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppDataProvider } from '../AppDataProvider';

describe('AppDataProvider', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AppDataProvider>
        <div>Test</div>
      </AppDataProvider>
    );
    expect(container).toBeTruthy();
  });
  
  // ... المزيد من الاختبارات
});
```

---

### اليوم 28: مراجعة نهائية وتوثيق 📋

#### Checklist النهائي

- [ ] ✅ RLS policies تعمل بشكل صحيح
- [ ] ✅ Auth/Profiles متزامنة
- [ ] ✅ لا توجد ملفات مكررة
- [ ] ✅ Context Providers مدمجة
- [ ] ✅ React Router مطبق
- [ ] ✅ Code splitting فعال
- [ ] ✅ Performance محسن
- [ ] ✅ TypeScript types نظيفة
- [ ] ✅ Error handling محسن
- [ ] ✅ Monitoring مفعل
- [ ] ✅ Tests الأساسية موجودة
- [ ] ✅ Documentation محدثة

#### تحديث README.md

```markdown
# Kueue RSVP Platform

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

### Environment Variables
\`\`\`env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SENTRY_DSN=your_sentry_dsn (optional)
\`\`\`

## 📁 Project Structure
\`\`\`
/components         # React components
/database          # SQL migrations & seeds
/router            # React Router setup
/utils             # Utility functions
/types             # TypeScript types
\`\`\`

## 🧪 Testing
\`\`\`bash
npm run test
\`\`\`

## 📊 Performance
- Lighthouse Score: 90+
- Bundle Size: <1MB (gzipped)
- First Contentful Paint: <1.5s

## 🔧 Maintenance
- Run database migrations: See `/database/migrations/README.md`
- Monitor errors: Sentry dashboard
- Performance metrics: Web Vitals
```

---

## 🎯 المقاييس المتوقعة بعد التنفيذ

### قبل الإصلاحات
- Bundle Size: ~2.5MB
- Initial Load: ~3-4s
- RLS Errors: متكررة
- TypeScript Coverage: ~60%
- Test Coverage: 0%

### بعد الإصلاحات
- Bundle Size: **~1MB** ✅ (تحسن 60%)
- Initial Load: **~1.5s** ✅ (تحسن 62%)
- RLS Errors: **0** ✅
- TypeScript Coverage: **>90%** ✅
- Test Coverage: **>40%** ✅

---

## 📞 الدعم والمتابعة

### نقاط التفتيش (Checkpoints)
1. **نهاية الأسبوع 1**: مراجعة الإصلاحات الحرجة
2. **نهاية الأسبوع 2**: قياس تحسينات الأداء
3. **نهاية الأسبوع 3**: مراجعة جودة الكود
4. **نهاية الأسبوع 4**: اختبار شامل ونشر

### الأدوات المطلوبة
- [ ] Supabase Dashboard Access
- [ ] Sentry Account (اختياري)
- [ ] Git/GitHub Access
- [ ] Node.js Development Environment

---

**ملاحظة**: هذه الخطة قابلة للتعديل حسب الأولويات والموارد المتاحة.

**تم الإعداد بواسطة**: AI Analysis System
**تاريخ الإصدار**: 22 أكتوبر 2025
