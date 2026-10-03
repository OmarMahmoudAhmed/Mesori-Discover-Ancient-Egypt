/*
 * =====================================================
 * QuizGroupPage.jsx - صفحة اختيار المرحلة
 * =====================================================
 *
 * هذه الصفحة تظهر عند الضغط على بطاقة مستوى في الصفحة الرئيسية.
 * تعرض قائمة بالمراحل الخمس داخل هذا المستوى:
 *
 * ┌─────────────────────────────────────────────────┐
 * │  <رجوع                              [إعدادات]   │
 * │   [شخصية]      Level 1          [أيقونة]        │
 * │   المستكشف         سهل           المستوى        │
 * │              اختر المرحلة                        │
 * │  ┌───────────────────────────────────────────┐  │
 * │  │ [نقاط] 100 نقطة  │  [أنبوب] 10 اختبارات    │  │
 * │  └───────────────────────────────────────────┘  │
 * │  ┌──────────────────────────────────────────┐   │
 * │  │ 1  [صورة]  البدايات        [ابدأ >]     │   │
 * │  ├──────────────────────────────────────────┤   │
 * │  │ 2  [صورة]  الحضارة         [قفل مقفول]  │   │
 * │  └──────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────┘
 * =====================================================
 */

import React from 'react';
import AppWrapper        from '../components/layout/AppWrapper';
import Header            from '../components/layout/Header';
import BottomNav         from '../components/layout/BottomNav';
import ExplorerCharacter from '../components/shared/ExplorerCharacter';
import { useApp }        from '../context/AppContext';

function QuizGroupPage() {

  /*
   * نجلب من Context:
   * pageData     = { levelId: X } المُمررة عند الضغط على بطاقة المستوى
   * userProfile  = لعرض شخصية المستخدم
   * navigateTo   = للتنقل لصفحة الاختبار
   * goBack       = للرجوع للصفحة السابقة
   */
  const { pageData, userProfile, navigateTo, goBack, levelsData } = useApp();

  /*
   * نجد بيانات المستوى المحدد من قائمة levelsData
   * باستخدام levelId من pageData
   *
   * find() = تبحث في المصفوفة وتُعيد العنصر الأول الذي يطابق الشرط
   * || levelsData[0] = احتياطياً إذا لم يُحدد levelId نعرض المستوى الأول
   */
  const currentLevel = levelsData.find(l => l.id === pageData?.levelId)
                       || levelsData[0];

  /*
   * handleStartStage - دالة بدء مرحلة معينة
   * @param stage {object} - بيانات المرحلة المختارة
   */
  const handleStartStage = (stage) => {
    if (!stage.isUnlocked) return; /* لا تفعل شيئاً إذا كانت مقفولة */
    navigateTo('quiz', {
      levelId: currentLevel.id,
      stageId: stage.id,
    });
  };

  return (
    <AppWrapper>
      <Header showBack={true} onBack={goBack} />

      <main
        className="flex-1 overflow-y-auto overflow-x-hidden app-scroll"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* ===== قسم الرأس: معلومات المستوى =====
          ⬅️ إعادة تصميم (مقاس متجاوب + ارتفاع أقصر):
          المشكلة القديمة: عمودان جانبيان بعرض ثابت 120px لكل واحد
          (240px إجمالي) جوه حاوية أقصى عرضها max-w-md (448px). على
          مقاس هاتف حقيقي (~360-390px) كان العمود النصي في النص
          (اسم المستوى ودرجة الصعوبة) بياخد أقل من 100px بس، وكمان
          شعار ميسوري الكبير (120px) وشخصية المستكشف (90px) سوا كانوا
          بياخدوا ارتفاع كبير من غير داعي أعلى الصفحة، فبيدفعوا كروت
          المراحل لتحت وبتحتاج تمرير عشان تبان كلها.
          الحل: عمودان جانبيان بعرض متجاوب (clamp بدل رقم ثابت) عشان
          يتناسبوا مع أي مقاس شاشة، استبدال شعار ميسوري (تكرار
          للهوية، مش معلومة جديدة للمستخدم اللي أصلاً جوه التطبيق)
          بأيقونة المستوى نفسها (معلومة مرتبطة بالمحتوى ومتوازنة مع
          حجم الشخصية)، وإزالة نسخة الأيقونة المكرّرة اللي كانت تحت
          العنوان. النتيجة: ارتفاع القسم اتقل بشكل واضح، والعمود
          النصي بقى له مساحة كافية على أي مقاس شاشة. */}
        <div className="flex items-center justify-center gap-3 px-4 pt-1 mb-3">

          {/* شخصية المستكشف — يمين الصفحة في RTL (أول عنصر بالـ DOM)، مقاس متجاوب */}
          <div className="flex-shrink-0 flex justify-center" style={{ width: 'clamp(52px, 16vw, 72px)' }}>
            <ExplorerCharacter size={72} gender={userProfile.character} className="w-full h-auto" />
          </div>

          {/* معلومات المستوى في المنتصف */}
          <div className="min-w-0 flex-1 flex flex-col items-center overflow-hidden">
            {/* شارة Level X */}
            <div
              className="px-4 py-1 rounded-full mb-1"
              style={{ backgroundColor: '#2D6A3F' }}
            >
              <span
                className="font-bold text-white text-sm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {currentLevel.nameEn}
              </span>
            </div>

            {/* اسم الصعوبة بالعربية — حجم مرن (clamp) عشان يتناسب مع
                عرض العمود على أي شاشة من غير ما يحتاج قصّ */}
            <h1
              className="font-black text-center truncate max-w-full leading-tight"
              style={{
                fontFamily: "'Cairo', sans-serif",
                color:      '#2D6A3F',
                fontSize:   'clamp(20px, 6vw, 26px)',
              }}
            >
              {currentLevel.nameAr}
            </h1>

            {/* عنوان فرعي */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-7 h-px" style={{ backgroundColor: '#C8922A' }} />
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={{
                  fontFamily: "'Cairo', sans-serif",
                  color:      '#8B4513',
                }}
              >
                اختر المرحلة
              </span>
              <div className="w-7 h-px" style={{ backgroundColor: '#C8922A' }} />
            </div>
          </div>

          {/* أيقونة المستوى — يسار الصفحة في RTL، بنفس مقاس الشخصية
              للتوازن البصري، بدل شعار ميسوري المكرّر */}
          <div className="flex-shrink-0 flex justify-center" style={{ width: 'clamp(52px, 16vw, 72px)' }}>
            <img
              src={currentLevel.iconSrc}
              alt={currentLevel.nameAr}
              className="w-full h-auto"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>


        {/* ===== شارات الإحصائيات ===== */}
        <div
          className="mx-4 mb-4 rounded-2xl px-3 py-2.5 flex items-center justify-around"
          style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,146,42,0.2)' }}
        >
          {/* النقاط */}
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#2D6A3F' }}
            >
              <i className="fi fi-rr-star" aria-hidden="true" style={{ fontSize: '15px', color: '#FFFFFF' }} />
            </div>
            <div>
              <p className="font-black text-base leading-none" style={{ color: '#3D2B1F', fontFamily: "'Cairo', sans-serif" }}>
                {currentLevel.maxPoints}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#8B5A2B', fontFamily: "'Cairo', sans-serif" }}>
                نقطة ممكنة
              </p>
            </div>
          </div>

          {/* فاصل عمودي */}
          <div className="w-px h-8" style={{ backgroundColor: 'rgba(200,146,42,0.3)' }} />

          {/* الاختبارات */}
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#1A7F8E' }}
            >
              <i className="fi fi-rr-document" aria-hidden="true" style={{ fontSize: '15px', color: '#FFFFFF' }} />
            </div>
            <div>
              <p className="font-black text-base leading-none" style={{ color: '#3D2B1F', fontFamily: "'Cairo', sans-serif" }}>
                {currentLevel.quizCount}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#8B5A2B', fontFamily: "'Cairo', sans-serif" }}>
                اختبارات
              </p>
            </div>
          </div>
        </div>


        {/* ===== قائمة المراحل ===== */}
        <div className="px-4 space-y-3">
          {currentLevel.stages.map((stage, index) => (

            <div
              key={stage.id}
              onClick={() => handleStartStage(stage)}
              className={`
                rounded-2xl overflow-hidden
                flex items-center gap-3 p-4
                transition-all duration-200
                ${stage.isUnlocked
                  ? 'cursor-pointer press-effect active:scale-98 shadow-card'
                  : 'cursor-not-allowed opacity-80'
                }
              `}
              style={{
                backgroundColor: 'white',
                border: stage.isUnlocked
                  ? '1.5px solid rgba(45,106,63,0.2)'
                  : '1.5px solid rgba(150,150,150,0.2)',
              }}
            >

              {/* رقم المرحلة */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#2D6A3F' }}
              >
                <span className="font-black text-white text-sm"
                  style={{ fontFamily: "'Cairo', sans-serif" }}>
                  {index + 1}
                </span>
              </div>

              {/*
                * أيقونة المرحلة: إيموجي المرحلة (stage.emoji) — متوفر في
                * البيانات الثابتة وبيانات Supabase معاً.
                * أيقونة القفل: أيقونة Flaticon بدلاً من صورة مفقودة
                */}
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: stage.isUnlocked
                    ? '#F4E2BC'
                    : '#E5E7EB',
                }}
              >
                {stage.isUnlocked ? (
                  <span
                    className="text-3xl leading-none"
                    style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.12))' }}
                    role="img"
                    aria-label={stage.title}
                  >
                    {stage.emoji}
                  </span>
                ) : (
                  <i className="fi fi-rr-lock" aria-hidden="true" style={{ fontSize: '20px', color: '#9CA3AF' }} />
                )}
              </div>

              {/* نص المرحلة */}
              <div className="flex-1 min-w-0">
                <h3
                  className="font-bold text-base truncate"
                  style={{
                    fontFamily: "'Cairo', sans-serif",
                    color: stage.isUnlocked ? '#2D6A3F' : '#6B7280',
                  }}
                >
                  {stage.title}
                </h3>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{
                    fontFamily: "'Cairo', sans-serif",
                    color: stage.isUnlocked ? '#5A3A1A' : '#9CA3AF',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {stage.isUnlocked ? stage.description : stage.unlockCondition}
                </p>
              </div>

              {/* زر البدء أو القفل */}
              {stage.isUnlocked ? (
                <button
                  className="
                    flex-shrink-0 flex items-center gap-1.5
                    px-4 py-2.5 rounded-xl
                    font-bold text-white text-sm
                    press-effect
                  "
                  style={{
                    backgroundColor: '#2D6A3F',
                    fontFamily: "'Cairo', sans-serif",
                  }}
                  onClick={(e) => { e.stopPropagation(); handleStartStage(stage); }}
                >
                  ابدأ
                  {/* أيقونة Flaticon Uicons (fi fi-rr-arrow-small-right) بدلاً من صورة PNG */}
                  <i className="fi fi-rr-arrow-small-right" aria-hidden="true" style={{ fontSize: '14px', color: '#FFFFFF' }} />
                </button>
              ) : (
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#F3F4F6' }}
                >
                  <i className="fi fi-rr-lock" aria-hidden="true" style={{ fontSize: '16px', color: '#9CA3AF' }} />
                </div>
              )}

            </div>
          ))}
        </div>

      </main>

      <BottomNav activePage="home" />
    </AppWrapper>
  );
}

export default QuizGroupPage;
