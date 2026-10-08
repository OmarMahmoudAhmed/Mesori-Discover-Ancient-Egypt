/*
 * =====================================================
 * QuizPage.jsx - صفحة الاختبار الفعلي
 * =====================================================
 *
 * هذه الصفحة تظهر عند الضغط على "ابدأ" في QuizGroupPage.
 * تعرض أسئلة المرحلة المحددة واحداً تلو الآخر:
 *
 * ┌─────────────────────────────────────────────────┐
 * │  <رجوع                              [إعدادات]   │
 * │        [Level 1]  🏜️ البدايات                   │
 * │        السؤال 3 من 10        2 إجابة صحيحة       │
 * │        ██████████░░░░░░░░░░░░░░░░░░░░           │
 * │  ┌───────────────────────────────────────────┐  │
 * │  │        ما هو النهر الذي قامت حوله...       │  │
 * │  └───────────────────────────────────────────┘  │
 * │  ┌───────────────────────────────────────────┐  │
 * │  │  نهر الفرات                                │  │
 * │  ├───────────────────────────────────────────┤  │
 * │  │  نهر النيل                          ✓      │  │  ← بعد الإجابة
 * │  ├───────────────────────────────────────────┤  │
 * │  │  نهر دجلة                                  │  │
 * │  └───────────────────────────────────────────┘  │
 * │  💬 إجابة صحيحة! ... (معلومة إضافية)            │
 * │  [       السؤال التالي        →]               │
 * └─────────────────────────────────────────────────┘
 *
 * بعد آخر سؤال تظهر شاشة النتيجة النهائية بدلاً من ذلك:
 * الدرجة + النقاط المكتسبة + إعادة المحاولة / العودة للمراحل.
 *
 * من أين تأتي بيانات هذه الصفحة؟
 * ─────────────────────────────────────────────
 * pageData = { levelId, stageId } تُمرَّر من QuizGroupPage عبر:
 * navigateTo('quiz', { levelId, stageId })
 *
 * أسئلة كل مرحلة تُقرأ من Supabase (جدول questions) باستخدام stage_id.
 * لو مرحلة معينة لسه مفيش لها أسئلة في قاعدة البيانات، تظهر شاشة
 * "غير متاح بعد" بدل أي خطأ في الكود.
 *
 * حساب النقاط:
 * ─────────────────────────────────────────────
 * نقاط كل سؤال = (أقصى نقاط المستوى ÷ عدد مراحله) ÷ عدد أسئلة
 * المرحلة. بأرقام المستوى 1 الحالية: (100 ÷ 5) ÷ 10 = 2 نقطة
 * لكل إجابة صحيحة. الحساب ديناميكي من levels.js، مش رقم ثابت،
 * فلو غيّرت maxPoints أو عدد الأسئلة هيتحدّث تلقائياً.
 *
 * ملاحظة تصميم: هذه الصفحة لا تعرض BottomNav عمداً — الهدف
 * تركيز المستخدم أثناء الاختبار ومنع خروجه بالخطأ عبر أزرار
 * التنقل السفلي بدون تحذير. زر "رجوع" في الهيدر هو المخرج
 * الوحيد أثناء الأسئلة، وهو محمي بنافذة تأكيد (showExitConfirm)
 * حتى لا يفقد المستخدم تقدمه بضغطة واحدة بالخطأ.
 *
 * الانتقال بين المراحل والمستويات:
 * ─────────────────────────────────────────────
 * عند إكمال آخر سؤال، تُستدعى completeStage() من AppContext
 * (بدلاً من addPoints() فقط كما كان سابقاً). هذه الدالة:
 * - تُعلّم المرحلة كمكتملة، وتفتح المرحلة التالية تلقائياً
 * - لو كانت آخر مرحلة في المستوى، تفتح المستوى التالي بالكامل
 * - تُرجع أين تقع "المرحلة التالية" بالضبط، فتظهر شاشة النتيجة
 *   زر "المرحلة التالية →" يأخذ المستخدم إليها مباشرة دون
 *   الحاجة للرجوع لقائمة المراحل يدوياً في كل مرة
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import AppWrapper        from '../components/layout/AppWrapper';
import Header            from '../components/layout/Header';
import ExplorerCharacter from '../components/shared/ExplorerCharacter';
import { useApp }        from '../context/AppContext';
import { supabase }      from '../lib/supabaseClient';
import { playSound }     from '../lib/sounds';
import { shuffleArray, shuffleQuestionOptions } from '../lib/shuffle';


/*
 * AnswerOption - زر اختيار واحد من اختيارات السؤال
 * ─────────────────────────────────────────────
 * أربع حالات بصرية ممكنة (state):
 *   'default'   → لسه ماحدش اختار (أبيض عادي)
 *   'correct'   → هذا هو الاختيار الصحيح (يظهر دائماً أخضر بعد الإجابة)
 *   'incorrect' → هذا ما اختاره المستخدم وكان غلط (أحمر)
 *   'dimmed'    → اختيار آخر غير مُختار وغير صحيح (باهت)
 */
function AnswerOption({ text, state, onClick, disabled }) {

  const stateStyles = {
    default:   { bg: '#FFFFFF',                border: 'rgba(200,146,42,0.3)', text: '#3D2B1F', opacity: 1    },
    correct:   { bg: 'rgba(45,106,63,0.1)',     border: '#2D6A3F',              text: '#2D6A3F', opacity: 1    },
    incorrect: { bg: 'rgba(220,38,38,0.08)',    border: '#DC2626',              text: '#DC2626', opacity: 1    },
    dimmed:    { bg: '#FFFFFF',                 border: 'rgba(150,150,150,0.2)',text: '#9CA3AF', opacity: 0.5  },
  };
  const s = stateStyles[state];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        w-full flex items-center justify-between gap-3
        px-4 py-3.5 rounded-2xl
        press-effect no-tap-highlight
        transition-colors duration-200
      "
      style={{
        backgroundColor: s.bg,
        border:          `2px solid ${s.border}`,
        opacity:         s.opacity,
        cursor:          disabled ? 'default' : 'pointer',
      }}
    >
      <span
        className="font-bold text-sm flex-1 text-right"
        style={{ fontFamily: "'Cairo', sans-serif", color: s.text }}
      >
        {text}
      </span>

      {/* دائرة صح خضراء بجانب الاختيار الصحيح */}
      {state === 'correct' && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#2D6A3F' }}
        >
          <i className="fi fi-rr-check" aria-hidden="true" style={{ fontSize: '11px', color: '#FFFFFF' }} />
        </div>
      )}

      {/* دائرة خطأ حمراء بجانب اختيار المستخدم الغلط */}
      {state === 'incorrect' && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#DC2626' }}
        >
          <i className="fi fi-rr-cross" aria-hidden="true" style={{ fontSize: '11px', color: '#FFFFFF' }} />
        </div>
      )}
    </button>
  );
}


function QuizPage() {

  /*
   * نجلب من Context:
   * pageData     = { levelId, stageId } المُمررة من QuizGroupPage
   * userProfile  = لعرض شخصية المستخدم في شاشة النتيجة
   * navigateTo   = للانتقال لصفحة اختيار المرحلة أو المرحلة التالية
   * goBack       = للرجوع الفعلي بعد تأكيد الخروج
   * levelsData   = بيانات المستويات/المراحل (ديناميكية الآن)
   * completeStage= إنهاء المرحلة + فتح التالية + تحديث النقاط
   */
  const { pageData, userProfile, navigateTo, goBack, levelsData, completeStage } = useApp();

  /* احتياطياً: لو دخل حد الصفحة من غير pageData صحيحة، نفترض المرحلة الأولى */
  const levelId = pageData?.levelId ?? 1;
  const stageId = pageData?.stageId ?? 1;

  /* نجد بيانات المستوى والمرحلة (نفس أسلوب البحث في QuizGroupPage) */
  const currentLevel = levelsData.find(l => l.id === levelId) || levelsData[0];
  const currentStage = currentLevel.stages.find(s => s.id === stageId) || currentLevel.stages[0];

  /* --------------------------------------------------
   * حالة الأسئلة - تُحمَّل من Supabase
   * -------------------------------------------------- */
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* --------------------------------------------------
   * حالة الاختبار (Local State)
   * currentQuestionIndex → رقم السؤال الحالي (0 = الأول)
   * selectedIndex        → رقم الاختيار الذي ضغط عليه المستخدم
   *                         (null = لسه ما جاوبش على السؤال الحالي)
   * correctCount          → عدد الإجابات الصحيحة حتى الآن
   * isFinished            → true بعد آخر سؤال (تظهر شاشة النتيجة)
   * showExitConfirm        → true لإظهار نافذة "متأكد إنك عايز تخرج؟"
   * -------------------------------------------------- */
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedIndex,        setSelectedIndex]        = useState(null);
  const [correctCount,         setCorrectCount]         = useState(0);
  const [isFinished,           setIsFinished]           = useState(false);
  const [showExitConfirm,      setShowExitConfirm]      = useState(false);
  /* نتيجة completeStage بعد إنهاء الاختبار: تحمل معلومة "أين المرحلة
   * التالية بالضبط؟" حتى تقدر شاشة النتيجة تعرض زر ينقل إليها مباشرة */
  const [completionResult,     setCompletionResult]     = useState(null);
  
  /* --------------------------------------------------
   * Timer & Heartbeat State - لإلغاء التايمرات عند الخروج
   * -------------------------------------------------- */
  const [timer, setTimer] = useState(null);
  const [heartbeatInterval, setHeartbeatInterval] = useState(null);
  const [isHeartbeatSkipped, setIsHeartbeatSkipped] = useState(false);

  /* تحميل الأسئلة من قاعدة البيانات عند تغيير المرحلة (levelId أو stageId) */
  useEffect(() => {
    /*
     * 🔑 الإصلاح الأساسي لمشكلة "زر المرحلة التالية ما بيشتغلش":
     * QuizPage نفس المكوّن (نفس الـ instance) يفضل شغّال لما تنتقل
     * من مرحلة لمرحلة تانية عن طريق زرار "المرحلة التالية" (بعكس
     * الرجوع لقائمة المراحل، اللي بيعمل unmount/remount كامل
     * للصفحة فيصفّرها تلقائياً). فلو ما صفّرناش isFinished/
     * currentQuestionIndex/completionResult... يدوياً هنا، هتفضل
     * شاشة نتيجة المرحلة "القديمة" ظاهرة فوق أسئلة المرحلة الجديدة
     * اللي اتحمّلت فعلاً في الخلفية — يعني عملياً الزرار "مش بيعمل
     * حاجة" من منظور المستخدم رغم إن التنقّل حصل فعلياً.
     */
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setCorrectCount(0);
    setIsFinished(false);
    setCompletionResult(null);
    setShowExitConfirm(false);
    
    // إلغاء أي تايمرات موجودة عند تغيير المرحلة
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
    setIsHeartbeatSkipped(false);

    async function loadQuestions() {
      setLoading(true);
      setError(null);

      try {
        console.log(`🔄 تحميل أسئلة المستوى ${levelId} / المرحلة ${stageId}...`);

        const { data, error: fetchError } = await supabase
          .from('questions')
          .select('*')
          .eq('level_id', levelId)   // 🔑 لازم level_id هنا برضه: stage_id
          .eq('stage_id', stageId)   //    لوحدها بتتكرر 1-10 عبر المستويات
          .order('id');

        if (fetchError) {
          console.error('❌ خطأ في تحميل الأسئلة:', fetchError);
          setError(fetchError.message);
          setQuestions([]);
          return;
        }

        if (!data || data.length === 0) {
          console.warn(`⚠️ لا توجد أسئلة للمرحلة ${levelId}-${stageId} في قاعدة البيانات.`);
          setQuestions([]);
          return;
        }

        // تحويل البيانات إلى الشكل المتوقع من المكون
        // ⬅️ ترتيب الأسئلة + ترتيب الاختيارات جوه كل سؤال بيتبعترا
        //    هنا — كل مرة تفتح المرحلة، وحتى لو نفس المستخدم كرّر
        //    نفس المرحلة تاني، الترتيب مختلف من غير ما يبان نمط
        //    ثابت (زي "الإجابة الصح دايماً أول اختيار")
        const formattedQuestions = shuffleArray(
          data.map((q) => shuffleQuestionOptions({
            id: q.id,
            question: q.question,
            options: q.options || [],
            correctIndex: q.correct_index,
            explanation: q.explanation || '',
          }))
        );

        console.log(`✅ تم تحميل ${formattedQuestions.length} سؤال للمرحلة ${levelId}-${stageId}`);
        setQuestions(formattedQuestions);
        
        // ✅ Skip heartbeat مؤقتاً بعد تحميل الأسئلة
        setIsHeartbeatSkipped(true);
        
        // إلغاء التايمر القديم لو موجود
        if (timer) {
          clearTimeout(timer);
          setTimer(null);
        }
        
        // إعادة تشغيل الـ heartbeat بعد 5 ثواني
        const newTimer = setTimeout(() => {
          setIsHeartbeatSkipped(false);
        }, 5000);
        setTimer(newTimer);

      } catch (err) {
        console.error('❌ خطأ غير متوقع:', err);
        setError(err.message);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [levelId, stageId]); // 🔑 يُعاد التحميل والتصفير عند تغيير أي منهما

  /*
   * 🔑 إلغاء التايمرات عند unmount للمكون
   */
  useEffect(() => {
    return () => {
      // إلغاء التايمر عند unmount
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        setHeartbeatInterval(null);
      }
    };
  }, [timer, heartbeatInterval]);

  /*
   * ===================================================
   * حالة التحميل: جاري تحميل الأسئلة من Supabase
   * ===================================================
   */
  if (loading) {
    return (
      <AppWrapper>
        <Header showBack={true} onBack={goBack} />
        <main
          className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
          style={{ paddingBottom: '48px' }}
        >
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#C8922A', borderTopColor: 'transparent' }}
          />
          <p
            className="text-sm font-semibold"
            style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
          >
            جاري تحميل الأسئلة...
          </p>
        </main>
      </AppWrapper>
    );
  }

  /*
   * ===================================================
   * حالة الخطأ: حدث خطأ في جلب الأسئلة
   * ===================================================
   */
  if (error) {
    return (
      <AppWrapper>
        <Header showBack={true} onBack={goBack} />
        <main
          className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
          style={{ paddingBottom: '48px' }}
        >
          <i className="fi fi-rr-exclamation" aria-hidden="true" style={{ fontSize: '46px', color: '#DC2626' }} />
          <h2 className="font-black text-xl" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
            حدث خطأ في تحميل الأسئلة
          </h2>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
            {error}
          </p>
          <button
            onClick={goBack}
            className="mt-2 px-6 py-3 rounded-2xl font-bold text-white press-effect no-tap-highlight"
            style={{ backgroundColor: '#2D6A3F', fontFamily: "'Cairo', sans-serif" }}
          >
            الرجوع لقائمة المراحل
          </button>
        </main>
      </AppWrapper>
    );
  }

  /*
   * ===================================================
   * حالة خاصة: لا توجد أسئلة لهذه المرحلة بعد
   * ===================================================
   * يحدث هذا لو أضفت مرحلة جديدة في levels.js وفتحتها
   * (isUnlocked: true) قبل ما تضيف أسئلتها في قاعدة البيانات.
   * بدل ما تنهار الصفحة، نعرض رسالة واضحة ونرجّعه بأمان.
   */
  if (!questions || questions.length === 0) {
    return (
      <AppWrapper>
        <Header showBack={true} onBack={goBack} />
        <main
          className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
          style={{ paddingBottom: '48px' }}
        >
          <i className="fi fi-rr-hourglass-start" aria-hidden="true" style={{ fontSize: '46px', color: '#805D1B' }} />
          <h2 className="font-black text-xl" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
            هذا الاختبار غير متاح بعد
          </h2>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
            سيتم إضافة أسئلة مرحلة "{currentStage?.title}" قريباً.
          </p>
          <button
            onClick={goBack}
            className="mt-2 px-6 py-3 rounded-2xl font-bold text-white press-effect no-tap-highlight"
            style={{ backgroundColor: '#2D6A3F', fontFamily: "'Cairo', sans-serif" }}
          >
            الرجوع لقائمة المراحل
          </button>
        </main>
      </AppWrapper>
    );
  }


  /* --------------------------------------------------
   * قيم مُشتقة (Derived Values) - تُحسب من الحالة الحالية
   * -------------------------------------------------- */
  const totalQuestions  = questions.length || 1;
  const question        = questions[currentQuestionIndex];
  const isAnswered       = selectedIndex !== null;
  const isCorrectAnswer  = selectedIndex === question.correctIndex;
  const isLastQuestion   = currentQuestionIndex === totalQuestions - 1;

  /* نقاط كل سؤال، محسوبة ديناميكياً من بيانات المستوى (راجع الشرح أعلى الملف) */
  const pointsPerQuestion = Math.max(
    1,
    Math.round((currentLevel.maxPoints / (currentLevel.totalStages || 1)) / totalQuestions)
  );

  /* نسبة تقدم شريط التقدم: تقفز فوراً عند الإجابة، مش عند الضغط على "التالي" فقط */
  const progressPercentage = Math.round(
    ((currentQuestionIndex + (isAnswered ? 1 : 0)) / totalQuestions) * 100
  );


  /*
   * getOptionState - تحدّد الشكل البصري لكل اختيار
   * @param index {number} - رقم الاختيار في مصفوفة options
   */
  const getOptionState = (index) => {
    if (!isAnswered) return 'default';
    if (index === question.correctIndex) return 'correct';
    if (index === selectedIndex) return 'incorrect';
    return 'dimmed';
  };


  /* --------------------------------------------------
   * handleSelectOption - عند ضغط المستخدم على اختيار
   * -------------------------------------------------- */
  const handleSelectOption = (index) => {
    if (isAnswered) return; /* منع تغيير الإجابة بعد اختيارها */
    setSelectedIndex(index);
    if (index === question.correctIndex) {
      setCorrectCount(prev => prev + 1);
      playSound('correct');
    } else {
      playSound('wrong');
    }
  };


  /* --------------------------------------------------
   * handleNext - الانتقال للسؤال التالي، أو لشاشة النتيجة
   * لو كان هذا آخر سؤال
   * -------------------------------------------------- */
  const handleNext = () => {
    if (isLastQuestion) {
      /*
       * correctCount هنا محدّثة بالفعل وتشمل السؤال الأخير،
       * لأن اختيار الإجابة (handleSelectOption) يحدث في ضغطة
       * منفصلة وسابقة لظهور زر "عرض النتيجة" أصلاً
       *
       * completeStage() تُنجز كل شيء دفعة واحدة: تُسجّل المرحلة
       * كمكتملة، تضيف النقاط (دون احتساب مضاعف عند إعادة المحاولة)،
       * وتفتح المرحلة/المستوى التالي تلقائياً — وتُرجع لنا مكان
       * "التالي" بالضبط لنعرض له زراً مباشراً في شاشة النتيجة.
       */
      const result = completeStage(levelId, stageId, correctCount * pointsPerQuestion);
      setCompletionResult(result);
      setIsFinished(true);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedIndex(null);
    }
  };


  /* --------------------------------------------------
   * handleRetry - إعادة الاختبار من السؤال الأول
   * -------------------------------------------------- */
  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setCorrectCount(0);
    setIsFinished(false);
    setCompletionResult(null);
  };

  /* العودة لقائمة مراحل نفس المستوى */
  const handleBackToStages = () => {
    navigateTo('quiz-group', { levelId });
  };

  /*
   * handleGoToNext - الانتقال مباشرة للمرحلة (أو المستوى) التالي
   * دون المرور بقائمة المراحل، وهذا بالضبط الانتقال "من اختبار
   * لاختبار" و"من مرحلة لمرحلة" الذي كان مفقوداً سابقاً.
   */
  const handleGoToNext = () => {
    if (completionResult?.nextStage) {
      navigateTo('quiz', completionResult.nextStage);
    }
  };

  /*
   * handleBackPress - ضغطة زر "رجوع" في الهيدر
   * أثناء الأسئلة: نعرض تأكيد الخروج (منعاً لفقدان التقدم بالخطأ)
   * في شاشة النتيجة: لا يوجد تقدم لنخسره، فنرجع مباشرة
   */
  const handleBackPress = () => {
    if (isFinished) {
      goBack();
    } else {
      // 🔑 إلغاء التايمر قبل عرض تأكيد الخروج
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        setHeartbeatInterval(null);
      }
      setShowExitConfirm(true);
    }
  };

  const confirmExit = () => {
    // 🔑 إلغاء كل التايمرات قبل الخروج نهائياً
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
    setShowExitConfirm(false);
    goBack();
  };


  /* --------------------------------------------------
   * رسالة شاشة النتيجة - تختلف حسب نسبة الإجابات الصحيحة
   * -------------------------------------------------- */
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
  const justFinishedEverything = completionResult?.isLastStageOverall && completionResult?.wasFirstCompletion;
  const resultMessage =
    justFinishedEverything  ? 'أسطوري! أكملت رحلتك بالكامل عبر تاريخ مصر القديمة! 🏆' :
    scorePercentage === 100 ? 'ممتاز! أنت مؤرخ مصري حقيقي!' :
    scorePercentage >= 70   ? 'أحسنت! معرفتك بتاريخ مصر القديمة رائعة!' :
    scorePercentage >= 40   ? 'جيد! استمر في التعلم واكتشف المزيد!' :
                               'لا بأس، حاول مرة أخرى وستتحسن بالتأكيد!';

  /* هل المرحلة التالية تقع في مستوى جديد كلياً؟ (يستحق تسمية مختلفة للزر) */
  const nextIsNewLevel = completionResult?.nextStage && completionResult.nextStage.levelId !== levelId;

  const finalPoints = correctCount * pointsPerQuestion;


  return (
    <AppWrapper>
      <Header showBack={true} onBack={handleBackPress} />

      {isFinished ? (

        /* =====================================================
         * شاشة النتيجة النهائية
         * ===================================================== */
        <main
          className="flex-1 overflow-y-auto app-scroll flex flex-col items-center justify-center px-6"
          style={{ paddingBottom: '32px' }}
        >
          <div className="w-full flex flex-col items-center animate-fade-in-up">

            {/* نجوم زخرفية */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#C8922A', fontSize: '9px' }}>✦</span>
              <span style={{ color: '#C8922A', fontSize: '15px' }}>✦</span>
              <span style={{ color: '#C8922A', fontSize: '9px' }}>✦</span>
            </div>

            <ExplorerCharacter size={100} gender={userProfile.character} />

            <h2
              className="font-black text-xl mt-3 text-center px-4"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}
            >
              {resultMessage}
            </h2>
            <p
              className="text-sm mt-1 text-center"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#8B4513' }}
            >
              أكملت مرحلة "{currentStage?.title}"
            </p>

            {/* دائرة الدرجة */}
            <div
              className="mt-6 mb-4 w-32 h-32 rounded-full flex flex-col items-center justify-center"
              style={{
                backgroundColor: currentLevel.bgColor,
                border:          `4px solid ${currentLevel.badgeText}`,
              }}
            >
              <span
                className="font-black text-3xl text-white"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                {correctCount}/{totalQuestions}
              </span>
              <span
                className="text-xs font-semibold mt-0.5"
                style={{ fontFamily: "'Cairo', sans-serif", color: currentLevel.badgeText }}
              >
                إجابة صحيحة
              </span>
            </div>

            {/* النقاط المكتسبة */}
            <div
              className="flex items-center gap-2 px-5 py-2.5 rounded-full mb-8"
              style={{ backgroundColor: '#FDF3E3', border: '1px solid rgba(200,146,42,0.3)' }}
            >
              <i className="fi fi-rr-star" aria-hidden="true" style={{ fontSize: '15px', color: '#805D1B' }} />
              <span
                className="font-bold text-sm"
                style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}
              >
                +{finalPoints} نقطة
              </span>
            </div>

            {/* زر الانتقال المباشر للمرحلة أو المستوى التالي (عند توفره) */}
            {completionResult?.nextStage && (
              <button
                onClick={handleGoToNext}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight mb-3"
                style={{ backgroundColor: '#C8922A', fontFamily: "'Cairo', sans-serif" }}
              >
                <span>{nextIsNewLevel ? 'الانتقال للمستوى التالي' : 'المرحلة التالية'}</span>
                <i className="fi fi-rr-arrow-small-right" aria-hidden="true" style={{ fontSize: '14px' }} />
              </button>
            )}

            {justFinishedEverything && (
              <p
                className="text-xs text-center mb-3 px-4"
                style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
              >
                أكملت كل المستويات الخمسة و25 مرحلة! يمكنك إعادة أي مرحلة من قائمة المراحل لتحسين نتيجتك.
              </p>
            )}

            {/* أزرار الإجراءات */}
            <div className="w-full flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 py-3.5 rounded-2xl font-bold press-effect no-tap-highlight"
                style={{ backgroundColor: '#F3F4F6', color: '#6B7280', fontFamily: "'Cairo', sans-serif" }}
              >
                إعادة المحاولة
              </button>
              <button
                onClick={handleBackToStages}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
                style={{ backgroundColor: '#2D6A3F', fontFamily: "'Cairo', sans-serif" }}
              >
                العودة للمراحل
              </button>
            </div>
          </div>
        </main>

      ) : (

        /* =====================================================
         * شاشة السؤال الحالي
         * ===================================================== */
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden app-scroll"
          style={{ paddingBottom: '32px' }}
        >

          {/* ===== شارة المستوى + اسم المرحلة ===== */}
          <div className="px-4 pt-1 flex items-center justify-center gap-2 mb-3">
            <div
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: currentLevel.headerBg }}
            >
              <span
                className="font-bold text-white"
                style={{ fontFamily: "'Cinzel', serif", fontSize: '11px' }}
              >
                {currentLevel.nameEn}
              </span>
            </div>
            <span
              className="font-bold text-sm"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}
            >
              {currentStage?.emoji} {currentStage?.title}
            </span>
          </div>

          {/* ===== عداد الأسئلة + شريط التقدم ===== */}
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-bold"
                style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
              >
                السؤال {currentQuestionIndex + 1} من {totalQuestions}
              </span>
              <span
                className="text-xs font-bold"
                style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
              >
                {correctCount} إجابة صحيحة
              </span>
            </div>
            <div
              dir="ltr"
              className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(61,43,31,0.15)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%`, backgroundColor: currentLevel.bgColor }}
              />
            </div>
          </div>


          {/* ===== بطاقة السؤال + الاختيارات (key تُعيد تشغيل الأنيميشن مع كل سؤال جديد) ===== */}
          <div key={question.id} className="animate-fade-in-up">

            <div className="px-4 mb-4">
              <div
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: 'white',
                  border:          '1px solid rgba(200,146,42,0.2)',
                  boxShadow:       '0 4px 15px rgba(61,43,31,0.08)',
                }}
              >
                <p
                  className="font-black text-lg leading-relaxed text-center"
                  style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}
                >
                  {question.question}
                </p>
              </div>
            </div>

            <div className="px-4 space-y-3">
              {question.options.map((option, index) => (
                <AnswerOption
                  key={index}
                  text={option}
                  state={getOptionState(index)}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(index)}
                />
              ))}
            </div>
          </div>


          {/* ===== شريط التغذية الراجعة + زر المتابعة (يظهران فقط بعد الإجابة) ===== */}
          {isAnswered && (
            <div className="px-4 mt-4 animate-fade-in-up">

              <div
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: isCorrectAnswer ? 'rgba(45,106,63,0.08)' : 'rgba(220,38,38,0.06)',
                  border:          `1.5px solid ${isCorrectAnswer ? 'rgba(45,106,63,0.3)' : 'rgba(220,38,38,0.3)'}`,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <i
                    className={isCorrectAnswer ? 'fi fi-rr-check-circle' : 'fi fi-rr-cross-circle'}
                    aria-hidden="true"
                    style={{ fontSize: '17px', color: isCorrectAnswer ? '#2D6A3F' : '#DC2626' }}
                  />
                  <span
                    className="font-black text-sm"
                    style={{ fontFamily: "'Cairo', sans-serif", color: isCorrectAnswer ? '#2D6A3F' : '#DC2626' }}
                  >
                    {isCorrectAnswer
                      ? 'إجابة صحيحة!'
                      : `إجابة خاطئة، الصحيحة: ${question.options[question.correctIndex]}`}
                  </span>
                </div>
                {question.explanation && (
                  <p
                    className="text-xs leading-relaxed"
                    style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
                  >
                    {question.explanation}
                  </p>
                )}
              </div>

              <button
                onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
                style={{ backgroundColor: '#2D6A3F', fontFamily: "'Cairo', sans-serif" }}
              >
                {isLastQuestion ? 'عرض النتيجة' : 'السؤال التالي'}
                <i className="fi fi-rr-arrow-small-right" aria-hidden="true" style={{ fontSize: '13px', color: '#FFFFFF' }} />
              </button>
            </div>
          )}

        </main>
      )}


      {/* ===== نافذة تأكيد الخروج (تظهر فقط أثناء الأسئلة، وليس في شاشة النتيجة) ===== */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            width: '100%',
            maxWidth: '448px',
            left: '50%',
            right: 'auto',
            transform: 'translateX(-50%)',
            padding: '0 24px',
            boxSizing: 'border-box',
          }}
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="w-full rounded-3xl p-6"
            style={{ backgroundColor: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="font-bold text-lg mb-2 text-center"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}
            >
              الخروج من الاختبار؟
            </h3>
            <p
              className="text-sm text-center mb-4"
              style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
            >
              لو خرجت الآن، ستفقد تقدمك في هذا الاختبار.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white"
                style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: '#2D6A3F' }}
              >
                متابعة الاختبار
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: '#F3F4F6', color: '#6B7280' }}
              >
                الخروج
              </button>
            </div>
          </div>
        </div>
      )}

    </AppWrapper>
  );
}

export default QuizPage;