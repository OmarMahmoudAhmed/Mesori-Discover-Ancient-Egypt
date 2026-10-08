/*
 * =====================================================
 * AppWrapper.jsx - الغلاف الرئيسي لكل صفحات التطبيق
 * =====================================================
 *
 * وظيفة هذا المكوّن:
 * 1. تحديد عرض التطبيق (max-w-md = 448px للموبايل)
 * 2. توسيط التطبيق على الشاشات الكبيرة
 * 3. تطبيق خلفية التطبيق (صورة PNG ستُضاف لاحقاً + لون رملي احتياطي)
 * 4. ضمان ارتفاع الشاشة الكامل
 *
 * هيكل التصميم على الشاشات المختلفة:
 * ┌────────────────────────────────────────────────┐
 * │  موبايل: التطبيق يملأ الشاشة كاملاً          │
 * │  ┌──────────────────┐                          │
 * │  │   تطبيق ميسوري  │                          │
 * │  └──────────────────┘                          │
 * │                                                │
 * │  شاشة كبيرة: التطبيق في المنتصف               │
 * │  ██ ┌──────────────────┐ ██                    │
 * │  ██ │   تطبيق ميسوري  │ ██  (خلفية داكنة)    │
 * │  ██ └──────────────────┘ ██                    │
 * └────────────────────────────────────────────────┘
 *
 * الخصائص (Props):
 * @prop children {ReactNode} - المحتوى الداخلي (Header + Main + BottomNav)
 * =====================================================
 */

import React, { useEffect } from 'react';
import { playSound } from '../../lib/sounds';

function AppWrapper({ children }) {

  /*
   * صوت نقرة عام — نقطة واحدة تغطي كل التطبيق بدل ما نضيف
   * onClick لكل زرار في عشرات الملفات. مستمع واحد على document
   * (آمن: صفحة واحدة بس متركّبة في أي وقت عبر switch/case في
   * App.jsx، فمفيش خطر تكرار المستمع). بيغطي: button, العنصر
   * العام press-effect (مستخدم في أغلب الصفوف/الأزرار)،
   * [role="button"]، وكروت المستويات (spectral-card-wrapper).
   * لو ضفت عنصر تفاعلي جديد بستايل مخصص مش من ضمن دول، ضيفله
   * كلاس press-effect (هيدّيه برضه تأثير الضغط البصري الموجود)
   * أو زوّد القائمة هنا.
   */
  useEffect(() => {
    function handleGlobalClick(e) {
      if (e.target.closest('button, .press-effect, [role="button"], .spectral-card-wrapper')) {
        playSound('click');
      }
    }
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  return (

    /*
     * الطبقة الخارجية: خلفية داكنة لملء الفراغ حول التطبيق
     * على الشاشات الكبيرة فقط
     * flex + justify-center: يوسّط حاوية التطبيق أفقياً
     * min-h-screen: يضمن ملء الشاشة كاملاً
     */
    <div
      className="min-h-dvh w-full flex justify-center"
      style={{ backgroundColor: '#1a1a1a' }}
    >

      {/*
        * حاوية التطبيق الرئيسية:
        *
        * w-full       = يأخذ العرض الكامل على الموبايل
        * max-w-md     = الحد الأقصى 448px (مثالي للموبايل والتابلت)
        * min-h-dvh    = ارتفاع الشاشة الفعلي المرئي (مش 100vh القديمة،
        *                اللي بتتحسب كأن شريط عنوان المتصفح مختفي دايماً
        *                وبتقص جزء من أسفل الشاشة فعلياً على الموبايل)
        * flex flex-col= ترتيب عمودي: Header + Main + BottomNav
        * relative     = لتمكين العناصر المُحددة الموقع داخله
        * overflow-x-hidden = يمنع التمرير الأفقي العرضي
        */}
      <div
        className="
          w-full max-w-md
          min-h-dvh
          flex flex-col
          relative
          overflow-x-hidden
        "
        style={{
          backgroundColor: '#F4E2BC', /* لون الرمال الفرعونية — يظهر كخلفية احتياطية طالما الصورة غير مُضافة بعد */

          /*
           * 🖼️ صورة الخلفية الكاملة للتطبيق (أعمدة + عين حورس + هيروغليفية + مويجات + كثبان)
           * WebP بدل PNG — نفس الشكل بالظبط، 456KB → 11KB (كانت بتتحمّل
           * مع كل صفحة لأنها هنا في AppWrapper المشترك)
           */
          backgroundImage:    'url(/assets/backgrounds/app-background.webp)',
          backgroundRepeat:   'repeat-y',   /* تتكرر عمودياً إن كان المحتوى أطول من الصورة (الصفحة قابلة للتمرير) */
          backgroundPosition: 'top center',
          backgroundSize:     '100% auto', /* تمتد بعرض التطبيق كاملاً */
        }}
      >

        {/*
          * محتوى الصفحة:
          * هنا يُحقن كل ما هو داخل AppWrapper:
          * - Header
          * - المحتوى الرئيسي (main)
          * - BottomNav
          */}
        {children}

      </div>
    </div>
  );
}

export default AppWrapper;
