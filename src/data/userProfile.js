/*
 * userProfile.js - البيانات الافتراضية للمستخدم الجديد
 * =====================================================
 * هذه القيم الافتراضية تُستخدم عند:
 * 1. أول تشغيل للتطبيق (قبل أن يدخل المستخدم بياناته)
 * 2. كمرجع لهيكل بيانات المستخدم في التطبيق
 *
 * عند الترحيل لـ Supabase:
 * - هذا الكائن سيُعادل جدول "profiles" في قاعدة البيانات
 * - سيُجلب بعد تسجيل الدخول عبر:
 *   const { data } = await supabase
 *     .from('profiles')
 *     .select('*')
 *     .eq('id', user.id)
 *     .single();
 * =====================================================
 */

export const initialUserProfile = {
  id:              'user_001',           /* UUID في Supabase */
  name:            'مكتشف',             /* الاسم الظاهر في القائمة */
  age:             10,                   /* العمر بالسنوات */
  country:         'مصر',               /* اسم الدولة */
  countryFlag:     '🇪🇬',              /* إيموجي العلم */
  email:           'moktashif@email.com',
  character:       'boy',               /* 'boy' أو 'girl' */
  currentLevel:    1,                   /* المستوى الحالي (1-5) */
  completedStages: 2,                   /* مراحل منجزة (من أصل 25) */
  totalPoints:     300,                 /* مجموع النقاط */
  rank:            12,                  /* الترتيب في القائمة */
  joinDate:        '2024-01-15',        /* created_at في Supabase */
};
