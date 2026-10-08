/*
 * =====================================================
 * App.jsx - المكوّن الجذر للتطبيق
 * =====================================================
 *
 * هذا الملف هو "محطة التوزيع" الرئيسية.
 * يقوم بـ:
 * 1. تغليف التطبيق بـ AppProvider (مزود البيانات)
 * 2. اختيار الصفحة الصحيحة للعرض حسب currentPage
 *
 * هيكل المكوّنات:
 * ┌─────────────────────────────────────────┐
 * │  AppProvider (مزود البيانات العامة)     │
 * │  └── AppContent                         │
 * │       ├── (غير مسجّل دخول) → LoginPage  │
 * │       ├── (لسه ما اختارش بياناته) →     │
 * │       │        OnboardingPage           │
 * │       └── (جاهز) → الصفحات المعتادة:    │
 * │            HomePage / QuizGroupPage /   │
 * │            QuizPage / LeaderboardPage / │
 * │            ProfilePage                  │
 * └─────────────────────────────────────────┘
 *
 * لماذا AppContent منفصل عن App؟
 * ─────────────────────────────────────────────
 * useApp() يجب استخدامه داخل AppProvider.
 * إذا كتبنا useApp() مباشرة في App() فسنحصل على خطأ
 * لأن AppProvider لم يُهيَّأ بعد عند تنفيذ App().
 * الحل: وضع منطق القراءة (useApp) في AppContent
 * ومنطق التهيئة (AppProvider) في App.
 * =====================================================
 */

import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

/* استيراد مزود البيانات والـ Hook */
import { AppProvider, useApp } from './context/AppContext';
import { setSoundEnabled } from './lib/sounds';
import { scheduleInactivityReminder, cancelInactivityReminder } from './lib/notifications';

/* استيراد جميع الصفحات */
import LoginPage        from './pages/LoginPage';
import OnboardingPage   from './pages/OnboardingPage';
import HomePage        from './pages/HomePage';
import QuizGroupPage   from './pages/QuizGroupPage';
import QuizPage        from './pages/QuizPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage     from './pages/ProfilePage';
import VsLobbyPage         from './pages/VsLobbyPage';
import VsMatchPage         from './pages/VsMatchPage';
import DeveloperInfoPage   from './pages/DeveloperInfoPage';
import LoadingAnkh          from './components/shared/LoadingAnkh';
import AgeGate              from './components/shared/AgeGate';
import AgeBlockedScreen     from './components/shared/AgeBlockedScreen';
import { isAgeBlocked, hasPassedAgeGate } from './lib/ageGate';

/*
 * شاشة تحميل بسيطة أثناء فحص الجلسة/البروفايل
 * ⬅️ كانت إيموجي 🏺 ثابت (شكله بيختلف حسب نظام التشغيل/المتصفح)،
 *   استُبدلت بعنخ SVG متحرك (نفس هوية شعار التطبيق) بتوهّج ولمعة
 *   ذهبية، بدل تدوير كامل (شكل العنخ غير متماثل).
 * ⬅️ min-h-screen (=100vh) كانت بتُقصّ جزء من الشاشة على متصفحات
 *   الموبايل — نفس الباگ اللي اتصلّح في AppWrapper سابقاً، فات هنا
 *   واتصلّح دلوقتي.
 */
function SplashLoader() {
  return (
    <div
      className="min-h-dvh w-full flex items-center justify-center"
      style={{ backgroundColor: '#0F2D18' }}
    >
      <LoadingAnkh size={72} />
    </div>
  );
}

/*
 * AppContent - المكوّن الداخلي
 * يقرأ currentPage من Context ويعرض الصفحة المناسبة
 *
 * switch/case = بنية شرطية تُقارن قيمة currentPage
 * مع قيم ثابتة وتُعيد الصفحة المقابلة
 */
/*
 * مسار غير المسجّلين: بوابة السن ← شاشة الدخول. الجهاز اللي أجاب بسن
 * أقل من الحد بيفضل على شاشة "غير متاح" (راجع src/lib/ageGate.js).
 */
function LoggedOutFlow() {
  const [step, setStep] = useState(() => (isAgeBlocked() ? 'blocked' : hasPassedAgeGate() ? 'login' : 'gate'));
  if (step === 'blocked') return <AgeBlockedScreen />;
  if (step === 'gate') return <AgeGate onPassed={() => setStep('login')} onBlocked={() => setStep('blocked')} />;
  return <LoginPage />;
}

function AppContent() {

  const { currentPage, session, authLoading, profileLoading, userProfile, isSoundOn } = useApp();

  /* أي تغيير في مفتاح الصوت من الإعدادات (SettingsDropdown) يتطبّق
     فوراً على كل الأصوات الجديدة اللي هتتشغّل من sounds.js */
  useEffect(() => {
    setSoundEnabled(isSoundOn);
  }, [isSoundOn]);

  /*
   * تذكير عدم النشاط (48 ساعة):
   * لما التطبيق يروح للخلفية (المستخدم قفل أو غيّر تطبيق) بنجدول
   * إشعار محلي بعد 48 ساعة. لو رجع فتح التطبيق قبل كده، بنلغي
   * الإشعار المجدول فوراً — عشان كده الشرط بـ session: من غير
   * تسجيل دخول مفيش داعي نزعج حد بتذكير رجوع لتطبيق ما دخلوش أصلاً.
   */
  useEffect(() => {
    if (!session) return;

    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        cancelInactivityReminder();
      } else {
        scheduleInactivityReminder();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [session]);

  /*
   * بوابة تسجيل الدخول: بالترتيب —
   * 1) لسه بنفحص هل فيه جلسة محفوظة أصلاً؟ (لحظة واحدة عند فتح التطبيق)
   * 2) مفيش جلسة → صفحة الدخول/التسجيل
   * 3) فيه جلسة بس البروفايل لسه بيتحمّل → نفس شاشة التحميل
   * 4) البروفايل اتحمّل بس لسه ما اختارش اسمه/عمره/شخصيته → Onboarding
   * 5) كل حاجة جاهزة → التطبيق المعتاد
   */
  if (authLoading) return <SplashLoader />;
  if (!session) return <LoggedOutFlow />;
  if (profileLoading) return <SplashLoader />;
  if (!userProfile.onboardingCompleted) return <OnboardingPage />;

  /*
   * router بسيط مبني على switch/case
   * في المستقبل مع Next.js:
   * → كل صفحة ستكون ملف مستقل في مجلد /app
   * → مثل: /app/home/page.jsx, /app/quiz/page.jsx
   * → والتوجيه يكون بـ router.push('/home') بدلاً من navigateTo('home')
   */
  const renderPage = () => {
    switch (currentPage) {

      case 'home':
        /* الصفحة الرئيسية - الشاشة الأولى */
        return <HomePage />;

      case 'quiz-group':
        /* قائمة مراحل المستوى المحدد */
        return <QuizGroupPage />;

      case 'quiz':
        /* الاختبار الفعلي لمرحلة محددة */
        return <QuizPage />;

      case 'leaderboard':
        /* قائمة المتصدرين */
        return <LeaderboardPage />;

      case 'profile':
        /* الملف الشخصي والإحصائيات */
        return <ProfilePage />;

      case 'vs-mode':
        /* توافقاً مع أي رابط قديم يشاور على vs-mode (زرار Header) */
      case 'vs-lobby':
        /* بوابة نمط 1 ضد 1: عشوائي أو دعوة صديق */
        return <VsLobbyPage />;

      case 'vs-match':
        /* شاشة اللعب الفعلي (أو قبول/رفض دعوة) لمباراة محددة */
        return <VsMatchPage />;

      case 'developer-info':
        /* عن المطوّر (من قائمة الإعدادات) */
        return <DeveloperInfoPage />;

      default:
        /*
         * في حال وجود صفحة غير معروفة (لا يجب أن يحدث)
         * نعرض الصفحة الرئيسية كـ fallback
         */
        return <HomePage />;
    }
  };

  return renderPage();
}


/*
 * App - المكوّن الجذر النهائي
 * يُغلّف كل شيء بـ AppProvider
 *
 * هذا المكوّن هو ما يُصدَّر ويُستخدم في main.jsx
 */
function App() {
  return (
    /*
     * AppProvider يجب أن يحتضن جميع المكوّنات التي
     * تستخدم useApp() - أي الجميع تقريباً
     */
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
