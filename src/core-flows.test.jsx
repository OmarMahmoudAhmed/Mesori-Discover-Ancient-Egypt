import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './context/AppContext';
import { supabase } from './lib/supabaseClient';
import App from './App';
import QuizPage from './pages/QuizPage';
import SettingsDropdown from './components/layout/SettingsDropdown';
import ReportModal from './components/shared/ReportModal';
import TermsConsentModal from './components/shared/TermsConsentModal';
import { messageErrorCode, messageErrorTextAr } from './lib/serverErrors';
import { TERMS_VERSION } from './lib/legal';

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
 * 3) سلامة المحتوى (Google Play) — حذف الحساب والإبلاغ
 *    - قائمة الإعدادات: "السياسات والخصوصية" + "حذف حسابي" (للمسجّلين فقط)
 *    - حذف الحساب بيطلب كتابة "حذف" وبينادي Edge Function، وبيعرض خطأ لو فشل
 *    - الإبلاغ بيبعت القيم الصحيحة لـ report_user
 *
 * ⚠️ لماذا المجموعات في ملف واحد؟
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
  const state = {
    session: null, profile: null, levels: null, questionsFor: null,
    invokeResult: { data: { success: true }, error: null },
    rpcCalls: [], invokeCalls: [],
  };

  return {
    supabase: {
      /* handle مشترك — تتحكم فيه الاختبارات لضبط السيناريو */
      __test: {
        setSession: (s) => { state.session = s; },
        setProfile: (p) => { state.profile = p; },
        setLevels: (l) => { state.levels = l; },
        setQuestions: (fn) => { state.questionsFor = fn; },
        setInvokeResult: (r) => { state.invokeResult = r; },
        rpcCalls: state.rpcCalls,
        invokeCalls: state.invokeCalls,
        resetCalls: () => { state.rpcCalls.length = 0; state.invokeCalls.length = 0; },
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: state.session } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      rpc: (name, args) => { state.rpcCalls.push({ name, args }); return Promise.resolve({ error: null }); },
      functions: {
        invoke: (name, opts) => { state.invokeCalls.push({ name, opts }); return Promise.resolve(state.invokeResult); },
      },
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
  supabase.__test.setInvokeResult({ data: { success: true }, error: null });
  supabase.__test.resetCalls();
});

// =============================================
// المجموعة 1: بوابة تسجيل الدخول
// =============================================
describe('App - بوابة تسجيل الدخول', () => {
  beforeEach(() => {
    supabase.__test.setProfile(fakeProfile);
    localStorage.clear();
  });

  it('يعرض بوابة السن أولاً لو مفيش جلسة', async () => {
    render(<App />);
    expect(await screen.findByText('كم عمرك؟', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('ابدأ الرحلة')).not.toBeInTheDocument();
  });

  it('يعرض صفحة تسجيل الدخول بعد عبور بوابة السن', async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText('اكتب عمرك', {}, { timeout: 5000 }), { target: { value: '15' } });
    fireEvent.click(screen.getByText('متابعة'));
    expect(await screen.findByText('ابدأ الرحلة', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('أقل من 13 في بوابة السن: شاشة "غير متاح" وتفضل بعد إعادة التحميل', async () => {
    const { unmount } = render(<App />);
    fireEvent.change(await screen.findByPlaceholderText('اكتب عمرك', {}, { timeout: 5000 }), { target: { value: '12' } });
    fireEvent.click(screen.getByText('متابعة'));
    expect(await screen.findByText(/غير متاح لك حالياً/)).toBeInTheDocument();
    expect(screen.queryByText('ابدأ الرحلة')).not.toBeInTheDocument();
    unmount();

    render(<App />);
    expect(await screen.findByText(/غير متاح لك حالياً/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('كم عمرك؟')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText('اكتب عمرك'), { target: { value: '15' } });
    fireEvent.click(screen.getByText('ذكر'));
    fireEvent.click(screen.getByText('ابدأ المغامرة 🚀'));

    // completeOnboarding بيحدّث onboarding_completed محلياً فور النجاح،
    // فالمفروض التطبيق يعدي مباشرة لصفحة تانية (مش Onboarding ولا Login)
    await waitFor(() => {
      expect(screen.queryByText('أهلاً بيك في ميسوري!')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});


describe('Onboarding - الحد الأدنى للسن', () => {
  beforeEach(() => {
    supabase.__test.setProfile(fakeProfile);
    localStorage.clear();
  });

  it('سن أقل من 13: بيحذف الحساب ويعرض "غير متاح" بدل ما يكمّل', async () => {
    supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });
    render(<App />);
    await screen.findByText('أهلاً بيك في ميسوري!', {}, { timeout: 5000 });

    fireEvent.change(screen.getByPlaceholderText('مثال: أحمد'), { target: { value: 'يوسف' } });
    fireEvent.change(screen.getByPlaceholderText('اكتب عمرك'), { target: { value: '12' } });
    fireEvent.click(screen.getByText('ذكر'));
    fireEvent.click(screen.getByText('ابدأ المغامرة 🚀'));

    expect(await screen.findByText(/غير متاح لك حالياً/, {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(supabase.__test.invokeCalls.some((c) => c.name === 'delete-user-account')).toBe(true);
    });
    expect(localStorage.getItem('mesori_age_gate_blocked')).toBe('1');
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

// =============================================
// المجموعة 3: سلامة المحتوى — حذف الحساب والإبلاغ
// =============================================
describe('سلامة المحتوى - قائمة الإعدادات وحذف الحساب', () => {
  const loggedIn = () => supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });

  it('فيه "السياسات والخصوصية" و"حذف حسابي" ومفيش "شاركنا رأيك"', async () => {
    loggedIn();
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    expect(await screen.findByText('حذف حسابي')).toBeInTheDocument();
    expect(screen.getByText('السياسات والخصوصية')).toBeInTheDocument();
    expect(screen.queryByText('شاركنا رأيك')).not.toBeInTheDocument();
  });

  it('رابط السياسات بيفتح صفحة github.io الحيّة', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    fireEvent.click(await screen.findByText('السياسات والخصوصية'));
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/.+\.github\.io\/.+\/privacy-policy\.html$/),
      '_blank',
      'noopener,noreferrer'
    );
    open.mockRestore();
  });

  it('مبيظهرش "حذف حسابي" لو مفيش جلسة', async () => {
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    await screen.findByText('السياسات والخصوصية');
    await new Promise((r) => setTimeout(r, 50)); // نسيب getSession تخلّص
    expect(screen.queryByText('حذف حسابي')).not.toBeInTheDocument();
  });

  it('الحذف يتطلب كتابة "حذف" وبعدها ينادي Edge Function delete-user-account', async () => {
    loggedIn();
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    fireEvent.click(await screen.findByText('حذف حسابي'));

    const confirmBtn = await screen.findByRole('button', { name: 'حذف نهائياً' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/للتأكيد اكتب/), { target: { value: 'حذف حسابي' } });
    expect(confirmBtn).toBeDisabled(); // كلمة غلط
    fireEvent.change(screen.getByLabelText(/للتأكيد اكتب/), { target: { value: 'حذف' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    await waitFor(() => expect(supabase.__test.invokeCalls).toHaveLength(1));
    expect(supabase.__test.invokeCalls[0].name).toBe('delete-user-account');
  });

  it('لو الحذف فشل بيعرض رسالة خطأ ويرجّع الزر', async () => {
    loggedIn();
    supabase.__test.setInvokeResult({ data: null, error: new Error('boom') });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    fireEvent.click(await screen.findByText('حذف حسابي'));
    fireEvent.change(await screen.findByLabelText(/للتأكيد اكتب/), { target: { value: 'حذف' } });
    fireEvent.click(screen.getByRole('button', { name: 'حذف نهائياً' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف نهائياً' })).toBeEnabled();
    spy.mockRestore();
  });
});

describe('سلامة المحتوى - الإبلاغ', () => {
  it('الإرسال معطّل من غير سبب، وبعد الاختيار بينادي report_user بالقيم الصحيحة', async () => {
    supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });
    render(<AppProvider><ReportModal reportedUserId="bad-guy" notificationId={42} onClose={() => {}} /></AppProvider>);

    const send = await screen.findByRole('button', { name: 'إرسال البلاغ' });
    expect(send).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /إساءة أو تنمّر/ }));
    fireEvent.change(screen.getByPlaceholderText(/تفاصيل إضافية/), { target: { value: '  تفاصيل  ' } });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    expect(await screen.findByText('وصلنا بلاغك')).toBeInTheDocument();
    const call = supabase.__test.rpcCalls.find((c) => c.name === 'report_user');
    expect(call.args).toEqual({
      p_reported_user_id: 'bad-guy',
      p_reason: 'harassment',
      p_details: 'تفاصيل',
      p_notification_id: 42,
    });
  });
});

describe('سلامة المحتوى - الموافقة على الشروط والحظر', () => {
  const loggedIn = () => supabase.__test.setSession({ user: { id: FAKE_USER_ID, user_metadata: {} } });

  it('الموافقة معطّلة من غير تأشير الخانة، وبعدها بتنادي accept_terms بإصدار الشروط', async () => {
    loggedIn();
    const onAccepted = vi.fn();
    render(<AppProvider><TermsConsentModal onAccepted={onAccepted} onClose={() => {}} /></AppProvider>);

    const accept = await screen.findByRole('button', { name: 'أوافق' });
    expect(accept).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(accept).toBeEnabled();
    fireEvent.click(accept);

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    const call = supabase.__test.rpcCalls.find((c) => c.name === 'accept_terms');
    expect(call.args).toEqual({ p_version: TERMS_VERSION });
  });

  it('رابط شروط الاستخدام بيفتح صفحة github.io الحيّة', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    fireEvent.click(await screen.findByText('شروط الاستخدام'));
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/.+\.github\.io\/.+\/terms\.html$/),
      '_blank',
      'noopener,noreferrer'
    );
    open.mockRestore();
  });

  it('"اللاعبون المحظورون" بيظهر للمسجّلين بس، وبيفتح القائمة', async () => {
    loggedIn();
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    fireEvent.click(await screen.findByText('اللاعبون المحظورون'));
    expect(await screen.findByText('مفيش لاعبين محظورين')).toBeInTheDocument();
    expect(supabase.__test.rpcCalls.some((c) => c.name === 'list_blocked_users')).toBe(true);
  });

  it('مبيظهرش "اللاعبون المحظورون" لو مفيش جلسة', async () => {
    render(<AppProvider><SettingsDropdown isOpen={true} onClose={() => {}} /></AppProvider>);
    await screen.findByText('شروط الاستخدام');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('اللاعبون المحظورون')).not.toBeInTheDocument();
  });

  it('أكواد أخطاء السيرفر بتتحوّل لرسائل عربي من غير ما نكشف الحظر للمحظور', () => {
    expect(messageErrorCode(new Error('TERMS_NOT_ACCEPTED'))).toBe('TERMS_NOT_ACCEPTED');
    expect(messageErrorCode(new Error('boom'))).toBeNull();
    expect(messageErrorTextAr(new Error('MESSAGE_BLOCKED_BY_ME'))).toMatch(/حاظر/);
    expect(messageErrorTextAr(new Error('MESSAGE_UNAVAILABLE'))).not.toMatch(/حظر|محظور/);
    expect(messageErrorTextAr(new Error('RATE_LIMITED'))).toBeTruthy();
  });
});
