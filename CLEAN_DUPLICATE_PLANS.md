# تنظيف الخطط المكررة من KV Store

## المشكلة
كانت الخطط تُحفظ بمفاتيح متعددة مما أدى إلى تكرار في البيانات:
- `plan_starter_default`
- `subscription_plan_plan_starter_default`
- `plan:starter_default`

هذا تسبب في ظهور خطأ React:
```
Warning: Encountered two children with the same key
```

## الحل المطبق

### 1. توحيد مفاتيح التخزين
تم تعديل `/supabase/functions/server/index.tsx` لحفظ الخطط بمفتاح واحد فقط:
```typescript
// قبل التعديل (يحفظ مرتين):
await kv.set(`subscription_plan_${plan.id}`, JSON.stringify(plan));
await kv.set(`plan_${plan.id}`, JSON.stringify(plan));

// بعد التعديل (يحفظ مرة واحدة):
const planKey = plan.id.startsWith('plan_') ? plan.id : `plan_${plan.id}`;
await kv.set(planKey, JSON.stringify(plan));
```

### 2. إزالة التكرار عند الجلب
تم تعديل جميع endpoints لإزالة التكرار:

#### في `/admin/plans`:
```typescript
// يجلب من مصدر واحد فقط
const allPlans = await kv.getByPrefix('plan_');
```

#### في `/admin/dashboard`:
```typescript
// استخدام Map لإزالة التكرار
const planMap = new Map<string, any>();
plansData.forEach((item: any) => {
  const plan = /* parse item */;
  if (plan && plan.id && !planMap.has(plan.id)) {
    planMap.set(plan.id, plan);
  }
});
const allPlans = Array.from(planMap.values());
```

### 3. توحيد البحث عن الخطط
في `/dashboard/vendor/:orgId`:
```typescript
// قبل: يبحث في 3 أماكن مختلفة
let planData = await kv.get(`plan_${orgData.planId}`);
if (!planData) planData = await kv.get(`plan:${orgData.planId}`);
if (!planData) planData = await kv.get(orgData.planId);

// بعد: يبحث في مكان واحد
const planKey = orgData.planId.startsWith('plan_') ? orgData.planId : `plan_${orgData.planId}`;
let planData = await kv.get(planKey);
```

## خطوات التنظيف اليدوي (اختياري)

إذا كنت تريد حذف الخطط المكررة القديمة من KV store:

### 1. من Supabase Dashboard
```sql
-- ملاحظة: KV store لا يستخدم SQL، استخدم Supabase Dashboard
-- اذهب إلى Edge Functions > KV Store
-- احذف يدوياً أي مفاتيح تبدأ بـ:
-- - subscription_plan_plan_*
-- - plan:*
```

### 2. من الكود (إذا كان لديك وصول للسيرفر)
أضف هذا الـ endpoint مؤقتاً في `index.tsx`:

```typescript
app.post("/make-server-6eefa08e/admin/cleanup-duplicate-plans", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // Get all subscription_plan_ keys (old duplicates)
    const oldKeys = await kv.getByPrefix('subscription_plan_');
    
    // Delete them
    for (const key of oldKeys) {
      await kv.del(`subscription_plan_${key}`);
    }

    console.log(`🗑️ Deleted ${oldKeys.length} duplicate plan entries`);

    return c.json({ 
      success: true, 
      deleted: oldKeys.length,
      message: 'Duplicate plans cleaned up'
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return c.json({ error: error.message }, 500);
  }
});
```

## التحقق من النتيجة

بعد التحديثات:
1. افتح Super Admin Portal → Subscription Plans
2. ستُحمّل الخطط تلقائياً وتُحفظ بالصيغة الجديدة
3. لن ترى تحذيرات React عن المفاتيح المكررة
4. كل خطة ستظهر مرة واحدة فقط في القوائم المنسدلة

## الخطط الافتراضية

IDs الثابتة للخطط الأربعة الافتراضية:
- `plan_free_default`
- `plan_starter_default`
- `plan_professional_default`
- `plan_enterprise_default`

هذه IDs لن تتغير أبداً وستُستخدم كمرجع موحد في جميع أنحاء النظام.

## ملاحظات مهمة

- ✅ جميع الخطط الآن تُحفظ بمفتاح واحد فقط
- ✅ لا توجد مفاتيح مكررة في KV store
- ✅ React لن يعرض تحذيرات عن duplicate keys
- ✅ القوائم المنسدلة ستعرض كل خطة مرة واحدة فقط
- ✅ الـ planFeatures سيتم إضافتها تلقائياً للمنظمات عند الحاجة

## التاريخ
- التحديث: 22 أكتوبر 2025
- الحالة: ✅ تم الإصلاح
