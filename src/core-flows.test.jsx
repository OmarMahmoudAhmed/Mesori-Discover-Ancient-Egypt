import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './context/AppContext';
import { supabase } from './lib/supabaseClient';
import App from './App';
import QuizPage from './pages/QuizPage';

/*
 * =====================================================
 * الاختبارات الأساسية للتطبيق (ملف موحّد)
 * =====================================================
 * يتضمّن مجموعتين:
 *
 * 1) App — بوابة تسجيل الدخول
 *    - مفيش جلسة → LoginPage
 *    - جلسة + بروفايل فاضي → OnboardingPage
 *    - بعد إكمال Onboarding → الصفحة الرئيسية
 *
 * 2) QuizPage — الانتقال من مرحلة لمرحلة
 *    - زر "المرحلة التالية" بينقل لأسئلة جديدة فعلاً (نفس المستوى)
 *    - إنهاء آخر مرحلة في مستوى بينقل لمستوى جديد بالكامل
 *
 * ⚠️ لماذا المجموعتين في ملف واحد؟
 * في هذا الإعداد (vitest 4 + pool vmThreads) لا يُعزل الـ mock
 * لنفس المسار بين ملفات الاختبار: المكوّنات (App/AppContext) بتبقى
 * مقترنة بمثيل الـ mock اللي اتسجّل من أول ملف يشتغل، وملفات
 * الاختبار اللي بعده بتاخد mock منفصل لنفسها بس مش بيأثّر على
 * المكوّنات. فلما جمعنا المجموعتين في ملف واحد، فيه mock واحد
 * ومخطط وحدة واحد — سلوك حتمي ومستقل عن ترتيب التشغيل.
 * =====================================================
 */

// =============================================
// بيانات المحاكاة
// =============================================
const FAKE_USER_ID = '99999999-9999-9999-9999-999999999999';
const fakeProfile = { onboarding_completed: false, username: '', age: null, character: 'boy', total_points: 0, id: FAKE_USER_ID };

// مستوى 1: مرحلتين فقط (لتسهيل اختبار "نفس المستوى")
// مستوى 2: مرحلة واحدة (لاختبار "عبور حدود المستوى")
const mockLevels = [
  {
    id: 1, name_ar: 'سهل', name_en: 'LEVEL 1', difficulty: 'سهل', max_points: 100,
    stages: [
      { id: 1, level_id: 1, title: 'مرحلة 1-1', description: 'وصف 1-1', order_index: 1, emoji: '🏜️' },
      { id: 2, level_id: 1, title: 'مرحلة 1-2', description: 'وصف 1-2', order_index: 2, emoji: '🏛️' },
    ],
  },
  {
    id: 2, name_ar: 'متوسط', name_en: 'LEVEL 2', difficulty: 'متوسط', max_points: 100,
    stages: [
      { id: 1, level_id: 2, title: 'مرحلة 2-1', description: 'وصف 2-1', order_index: 1, emoji: '🏺' },
    ],
  },
];

// سؤال واحد فقط لكل مرحلة (يكفي لاختبار الانتقال، مش محتاجين 10)
function questionsFor(levelId, stageId) {
  return [{
    id: 1,
    question: `سؤال تجريبي للمستوى ${levelId} / المرحلة ${stageId}`,
    options: ['أ', 'ب', 'ج', 'د'],
    correct_index: 0,
    explanation: 'شرح تجريبي',
  }];
}

// =============================================
// Mock وحيد لموديول Supabase (يغطي كل استعلامات التطبيق)
// =============================================
vi.mock('./lib/supabaseClient', () => {
  const state = { session: null, profile: null, levels: null, questionsFor: null };

  return {
    supabase: {
      /* handle مشترك — تتحكم فيه الاختبارات لضبط السيناريو */
      __test: {
        setSession: (s) => { state.session = s; },
        setProfile: (p) => { state.profile = p; },
        setLevels: (l) => { state.levels = l; },
        setQuestions: (fn) => { state.questionsFor = fn; },
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: state.session } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      rpc: () => Promise.resolve({ error: null }),
      channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: () => {},
      from: (table) => {
        if (table === 'levels') {
          return { select: () => ({ order: () => Promise.resolve({ data: state.levels || [], error: null }) }) };
        }
        if (table === 'questions') {
          let levelId, stageId;
          const builder = {
            select: () => builder,
            eq: (col, val) => {
              if (col === 'level_id') levelId = val;
              if (col === 'stage_id') stageId = val;
              return builder;
            },
            order: () => Promise.resolve({
              data: state.questionsFor ? state.questionsFor(levelId, stageId) : [],
              error: null,
            }),
          };
          return builder;
        }
        if (table === 'profiles') {
          const builder = {
            select: () => builder,
            update: (updates) => {
              state.profile = { ...(state.profile || {}), ...updates };
              return { eq: () => Promise.resolve({ error: null }) };
            },
            eq: () => builder,
            single: () => Promise.resolve({ data: state.profile, error: null }),
          };
          return builder;
        }
        if (table === 'leaderboard') {
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
        }
        /* user_badges / notifications / matches / أي جدول آخر */
        const emptyBuilder = {
          select: () => emptyBuilder,
          eq: () => emptyBuilder,
          order: () => emptyBuilder,
          update: () => ({ eq: () => ({ is: () => Promise.resolve({ error: null }) }) }),
          single: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
          then: (resolve) => resolve({ data: [], error: null }),
        };
        return emptyBuilder;
      },
    },
  };
});

// إعادة ضبط الحالة المشتركة قبل كل اختبار لضمان عزل تام
beforeEach(() => {
  supabase.__test.setSession(null);
  supabase.__test.setProfile(null);
  supabase.__test.setLevels(null);
  supabase.__test.setQuestions(null);
});

// =============================================
// المجموعة 1: بوابة تسجيل الدخول
// =============================================
describe('App - بوابة تسجيل الدخول', () => {
  beforeEach(() => {
    supabase.__test.setProfile(fakeProfile);
  });

  it('يعرض صفحة تسجيل الدخول لو مفيش جلسة', async () => {
    render(<App />);
    expect(await screen.findByText('ابدأ الرحلة', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('يعرض شاشة Onboarding لو فيه جلسة بس البروفايل لسه فاضي', async () => {
    supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });

    render(<App />);
    expect(await screen.findByText('أهلاً بيك في ميسوري!', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('ينتقل للصفحة الرئيسية تلقائياً بعد إكمال Onboarding', async () => {
    supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });

    render(<App />);
    await screen.findByText('أهلاً بيك في ميسوري!', {}, { timeout: 5000 });

    fireEvent.change(screen.getByPlaceholderText('مثال: أحمد'), { target: { value: 'يوسف' } });
    fireEvent.change(screen.getByPlaceholderText('مثال: 10'), { target: { value: '11' } });
    fireEvent.click(screen.getByText('ذكر'));
    fireEvent.click(screen.getByText('ابدأ المغامرة 🚀'));

    // completeOnboarding بيحدّث onboarding_completed محلياً فور النجاح،
    // فالمفروض التطبيق يعدي مباشرة لصفحة تانية (مش Onboarding ولا Login)
    await waitFor(() => {
      expect(screen.queryByText('أهلاً بيك في ميسوري!')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

// =============================================
// المجموعة 2: الانتقال من مرحلة لمرحلة
// =============================================
// مكوّن اختبار صغير: بيعرض QuizPage مباشرة على مرحلة محددة
// (بيتخطى الصفحة الرئيسية وقائمة المراحل عشان نركّز على الباگ نفسه)
function TestHarness({ startLevelId, startStageId }) {
  const { navigateTo, currentPage } = useApp();
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (!started) {
      navigateTo('quiz', { levelId: startLevelId, stageId: startStageId });
      setStarted(true);
    }
  }, [started, navigateTo, startLevelId, startStageId]);

  if (currentPage !== 'quiz' || !started) return <div>loading-harness</div>;
  return <QuizPage />;
}

function renderQuiz(startLevelId, startStageId) {
  return render(
    <AppProvider>
      <TestHarness startLevelId={startLevelId} startStageId={startStageId} />
    </AppProvider>
  );
}

async function answerAndFinish() {
  // ينتظر ظهور سؤال حقيقي (مش شاشة تحميل)، يجاوب، ويضغط "عرض النتيجة"
  const firstOption = await screen.findByText('أ', {}, { timeout: 5000 });
  fireEvent.click(firstOption);
  const nextBtn = await screen.findByRole('button', { name: /عرض النتيجة|السؤال التالي/ }, { timeout: 5000 });
  fireEvent.click(nextBtn);
}

describe('QuizPage - الانتقال من مرحلة لمرحلة', () => {
  beforeEach(() => {
    supabase.__test.setLevels(mockLevels);
    supabase.__test.setQuestions(questionsFor);
  });

  it('ينتقل لأسئلة جديدة فعلياً عند الضغط على "المرحلة التالية" (نفس المستوى)', async () => {
    renderQuiz(1, 1);

    await answerAndFinish();

    // شاشة النتيجة ظهرت، وفيها زر "المرحلة التالية"
    const nextStageBtn = await screen.findByText('المرحلة التالية', {}, { timeout: 5000 });
    fireEvent.click(nextStageBtn);

    // 🔑 التحقق الحاسم: المفروض نشوف سؤال المرحلة 1-2 الجديد،
    // مش شاشة نتيجة المرحلة 1-1 القديمة تاني
    await waitFor(() => {
      expect(screen.getByText('سؤال تجريبي للمستوى 1 / المرحلة 2')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.queryByText('المرحلة التالية')).not.toBeInTheDocument();
  });

  it('ينتقل لمستوى جديد بالكامل عند إنهاء آخر مرحلة في المستوى', async () => {
    renderQuiz(1, 1); // يبدأ من أول مرحلة (مش قفزة مباشرة لآخر مرحلة، عشان يحاكي مسار لاعب حقيقي)

    // أكمل المرحلة 1-1 أولاً (شرط حقيقي لفتح 1-2)
    await answerAndFinish();
    const nextStageBtn = await screen.findByText('المرحلة التالية', {}, { timeout: 5000 });
    fireEvent.click(nextStageBtn);
    await waitFor(() => {
      expect(screen.getByText('سؤال تجريبي للمستوى 1 / المرحلة 2')).toBeInTheDocument();
    }, { timeout: 5000 });

    // ودلوقتي أكمل آخر مرحلة في المستوى (1-2) فعلياً
    await answerAndFinish();

    const nextLevelBtn = await screen.findByText('الانتقال للمستوى التالي', {}, { timeout: 5000 });
    fireEvent.click(nextLevelBtn);

    // المفروض ننتقل لأول مرحلة في المستوى 2
    await waitFor(() => {
      expect(screen.getByText('سؤال تجريبي للمستوى 2 / المرحلة 1')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
