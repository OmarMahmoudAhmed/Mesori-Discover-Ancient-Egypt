/*
 * =====================================================
 * VsMatchPage.jsx - شاشة اللعب الفعلي لمباراة 1 ضد 1
 * =====================================================
 * مُصمّمة للعب المزامن الفوري (Real-time Synchronized):
 * - Timer مُرسَل من السيرفر (question_started_at + question_time_limit_seconds)
 * - الانتقال التلقائي للسؤال التالي (advance_match_round عند إجابة اللاعبين)
 * - لا يوجد عدّاد محلي: السيرفر هو مصدر الحقيقة الوحيد
 * - انسحاب/عدم نشاط تلقائي: كل لاعب بيبعت نبضة حياة كل 7 ثواني طول ما
 *   الشاشة مفتوحة وفاتحة فعلياً (foreground). لو أي طرف فضل من غير
 *   نبضة 30 ثانية (خرج، قفل الشاشة، اتقطع نتّه)، المباراة بتتقفل فوراً
 *   كخسارة له — مش لازم تستنى باقي الأسئلة تخلص واحد واحد.
 *
 * حالات الصفحة:
 * 1) 'invite'   → دعوة ودّية لسه منتظرة قبولك
 * 2) 'loading'  → جاري تحميل حالة المباراة
 * 3) 'question' → سؤال حالي معروض مع عدّ تنازلي من السيرفر
 * 4) 'waiting'  → اللاعب خلّص الأسئلة، مستني الخصم يخلّص
 * 5) 'result'   → المباراة خلصت، عرض النتيجة (عادية أو بالانسحاب)
 * =====================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppWrapper from '../components/layout/AppWrapper';
import Header      from '../components/layout/Header';
import { useApp }  from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { playSound } from '../lib/sounds';
import { AvatarDisplay } from '../data/avatars';

// نبضة الحياة: كل 7 ثواني (يعني نافذة الـ30 ثانية بتسمح بفوات 3-4
// نبضات قبل ما اللاعب يتحسب منسحب — بيفرق بين انقطاع حقيقي وتقطيع
// شبكة بسيط)
const PRESENCE_INTERVAL_MS = 7000;
const FORFEIT_THRESHOLD_SECONDS = 30;
// نبدأ نوريّ تحذير عدم النشاط من هنا، مش من أول ثانية غياب — عشان
// مانضايقش اللاعب بتحذير على أي تأخر طبيعي بسيط في الرد
const INACTIVITY_WARNING_SECONDS = 10;

// بطاقتا "أنت مقابل الخصم" — نفس الفكرة الأساسية من المرجع (لاعبين
// جنب بعض حوالين المواجهة)، بس بأبسط شكل يتماشى مع تصميم التطبيق
// الحالي. مُستخدَمة في شاشتي 'waiting' و'question' الاتنين، فبقت
// مكوّن منفصل بدل تكرار نفس الـJSX مرتين.
function DuelBar({ userProfile, matchState, showInactivityWarning, secondsUntilForfeit }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-1.5 mb-2.5">
        <span className="text-base">⚔️</span>
        <p className="text-[11px] font-black tracking-wide" style={{ color: '#8B5A2B' }}>ساحة التحدي</p>
      </div>

      <div className="flex items-center gap-2">
        {/* بطاقة "أنت" */}
        <div
          className="flex-1 flex flex-col items-center gap-1 rounded-2xl py-2.5 px-2"
          style={{ backgroundColor: 'white', border: '1.5px solid rgba(45,106,63,0.25)' }}
        >
          <AvatarDisplay avatarKey={userProfile.character} size={38} />
          <p className="text-[10px] font-bold" style={{ color: '#3D2B1F' }}>أنت</p>
          <p className="text-base font-black" style={{ color: '#2D6A3F', fontVariantNumeric: 'tabular-nums' }}>
            {matchState.my_correct_count}
          </p>
        </div>

        <span className="text-lg flex-shrink-0">⚔️</span>

        {/* بطاقة الخصم — نفس البناء بالظبط للبوت وللإنسان، لأن الاتنين
            صفوف profiles حقيقية بنفس الشكل */}
        {matchState.opponent_username ? (
          <div
            className="flex-1 flex flex-col items-center gap-1 rounded-2xl py-2.5 px-2 relative"
            style={{
              backgroundColor: 'white',
              border: `1.5px solid ${showInactivityWarning ? '#F59E0B' : 'rgba(200,146,42,0.25)'}`,
            }}
          >
            {matchState.opponent_answered && !showInactivityWarning && (
              <span className="absolute -top-1 -right-1 text-xs">
                {matchState.opponent_correct ? '✅' : '❌'}
              </span>
            )}
            <AvatarDisplay avatarKey={matchState.opponent_character} size={38} />
            <p className="text-[10px] font-bold truncate max-w-full" style={{ color: '#3D2B1F' }}>
              {matchState.opponent_username}
            </p>
            <p className="text-base font-black" style={{ color: '#C8922A', fontVariantNumeric: 'tabular-nums' }}>
              {matchState.opponent_correct_count}
            </p>
          </div>
        ) : (
          <div className="flex-1 rounded-2xl py-2.5 px-2 flex items-center justify-center" style={{ backgroundColor: 'rgba(200,146,42,0.06)' }}>
            <p className="text-[10px]" style={{ color: '#8B5A2B' }}>...</p>
          </div>
        )}
      </div>

      {/* تحذير عدم النشاط — نفس أسلوب شريط "بنبحث عن خصم" في صفحة
          البوابة (نص + عدّاد داخل شريط دائري)، لكن هنا للانسحاب */}
      {showInactivityWarning && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5 py-1.5 px-3 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
          <span className="text-xs animate-pulse">⚠️</span>
          <p className="text-[10px] font-bold" style={{ color: '#B45309' }}>
            الخصم غير نشط — هتفوز تلقائياً خلال {secondsUntilForfeit} ثانية لو مرجعش
          </p>
        </div>
      )}
    </div>
  );
}

function VsMatchPage() {
  const {
    pageData, userProfile, navigateTo,
    getCurrentMatchState, submitMatchAnswer, submitBotAnswer, touchMatchPresence,
    acceptFriendlyMatch, declineFriendlyMatch,
  } = useApp();
  const matchId = pageData?.matchId;

  const [phase, setPhase] = useState('loading');
  const [matchState, setMatchState] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const resultSoundPlayedForRef = useRef(null); // آخر match id اتشغّله صوت النتيجة بتاعه

  /*
   * صوت الفوز/الخسارة/التعادل — مرة واحدة بس لما الصفحة توصل فعلياً
   * لمرحلة 'result' لأول مرة لكل مباراة (مش على كل إعادة رندر).
   * مفيش صوت لدعوة اترفضت أو مباراة اتلغت (isVoid) — مفيش نتيجة
   * حقيقية تستاهل فوز/خسارة هنا أصلاً.
   */
  useEffect(() => {
    if (phase !== 'result' || !matchState) return;
    if (resultSoundPlayedForRef.current === matchState.id) return;
    resultSoundPlayedForRef.current = matchState.id;

    const isVoidNow = matchState.end_reason === 'void';
    if (matchState.status === 'declined' || isVoidNow) return;

    const wonNow = matchState.winner_id === userProfile.id;
    const isDrawNow = !matchState.winner_id && matchState.status === 'finished';

    if (wonNow) playSound('win');
    else if (isDrawNow) playSound('draw');
    else playSound('loss'); // يشمل الخسارة العادية والخسارة بالانسحاب (forfeit)
  }, [phase, matchState, userProfile.id]);

  const isPlayer1 = matchState?.player_1_id === userProfile.id;
  const opponentId = matchState ? (isPlayer1 ? matchState.player_2_id : matchState.player_1_id) : null;

  // جلب حالة المباراة من السيرفر
  const fetchState = useCallback(async () => {
    if (!matchId) return;
    const { state, error } = await getCurrentMatchState(matchId);
    if (error || !state) { navigateTo('vs-lobby'); return; }
    setMatchState(state);

    if (state.status === 'finished' || state.status === 'declined' || state.status === 'abandoned') {
      setPhase('result');
    } else if (state.status === 'pending' && state.player_2_id === userProfile.id) {
      setPhase('invite');
    } else if (state.my_answered) {
      setPhase('waiting');
    } else {
      setPhase('question');
    }
    return state;
  }, [matchId, getCurrentMatchState, navigateTo, userProfile.id]);

  // تحميل أولي
  useEffect(() => { fetchState(); }, [fetchState]);

  // العدّ التنازلي المُرسَل من السيرفر
  useEffect(() => {
    if (phase !== 'question' || !matchState?.question_started_at || !matchState?.question_time_limit_seconds) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    const deadline = new Date(matchState.question_started_at).getTime() + (matchState.question_time_limit_seconds * 1000);

    function tick() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !hasSubmittedRef.current) {
        // انتهى الوقت: قدّم أي إجابة مختارة (أو فاضية)
        handleSubmit(true);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 200);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [phase, matchState?.question_started_at, matchState?.question_time_limit_seconds]);

  // استماع Realtime: أي تغيير في المباراة (سؤال جديد أو انتهاء)
  useEffect(() => {
    if (!matchId || !opponentId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}`,
      }, async (payload) => {
        const updated = payload.new;
        if (updated.status === 'finished' || updated.status === 'declined' || updated.status === 'abandoned') {
          // المباراة خلصت: اجلب النتيجة النهائية
          const { state: finalState } = await getCurrentMatchState(matchId);
          if (finalState) setMatchState(finalState);
          setPhase('result');
          return;
        }
        // سؤال جديد: اجلب الحالة الكاملة
        const newState = await fetchState();
        if (newState) {
          hasSubmittedRef.current = false;
          setSelectedIndex(null);
          setLastAnswerCorrect(null);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [matchId, opponentId, getCurrentMatchState, fetchState]);

  // =====================================================
  // محاكاة إجابة البوت — فقط لو المباراة ضد بوت. مفيش عميل تاني يمثّله،
  // فعميل اللاعب نفسه هو اللي بيحدد "امتى" البوت يجاوب (تأخير عشوائي
  // يحاكي وقت تفكير إنسان)، لكن الصح/الغلط بيتحسم في السيرفر
  // (submit_bot_answer) مش هنا — عشان يفضل نفس مصدر الحقيقة الوحيد.
  // =====================================================
  // التعديل: إزالة شرط phase نهائياً، والاعتماد فقط على opponent_answered
  // حتى لا يلغي المؤقت عند تغير phase بسبب إجابة اللاعب.
  useEffect(() => {
    if (!matchState?.is_bot_match) return;          // فقط مباريات البوت
    if (matchState.opponent_answered) return;       // سبق وأجاب البوت

    const deadline = matchState.question_started_at
      ? new Date(matchState.question_started_at).getTime() + matchState.question_time_limit_seconds * 1000
      : Date.now() + matchState.question_time_limit_seconds * 1000;
    const remainingMs = Math.max(1000, deadline - Date.now());

    // بين 1.5 ثانية و(الوقت المتبقي - نص ثانية أمان)، عشان يحس طبيعي
    // ومايجاوبش بالظبط في نفس اللحظة كل مرة
    const minDelay = 1500;
    const maxDelay = Math.max(minDelay + 400, remainingMs - 500);
    const delay = minDelay + Math.random() * (maxDelay - minDelay);

    const timer = setTimeout(() => {
      submitBotAnswer(matchId, matchState.current_question_index);
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState?.is_bot_match, matchState?.current_question_index, matchState?.opponent_answered, matchId, submitBotAnswer]);

  // إرسال الإجابة
  const handleSubmit = useCallback(async (isTimeout = false) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const idx = selectedIndex ?? 0;
    const { isCorrect } = await submitMatchAnswer(matchId, matchState.current_question_index, idx);
    setLastAnswerCorrect(isCorrect);

    // بعد الإجابة: انتظار Realtime event للسؤال التالي أو النتيجة
    setPhase('waiting');
  }, [matchId, matchState?.current_question_index, selectedIndex, submitMatchAnswer]);

  // =====================================================
  // نبضة الحياة + فحص الانسحاب — الآلية الفعلية اللي بتخلي الـ30
  // ثانية حقيقية، مش مجرد نص في الواجهة:
  //
  // 1) touchMatchPresence: بتحدّث last_seen بتاعي أنا في السيرفر
  // 2) fetchState: بتنادي get_current_match_state تاني، واللي
  //    بيشيل جوّاه فحص "هل أي طرف فضل أكتر من 30 ثانية من غير
  //    نبضة؟" — فلو حصل، المباراة بتتقفل فوراً كخسارة للطرف الغايب
  //    وبيوصلني نتيجة الانسحاب من نفس الاستدعاء، من غير ما أستنى
  //    Realtime event منفصل
  //
  // بتوقف تماماً لو الشاشة مش ظاهرة فعلياً (قفلت الموبايل، رحت
  // تطبيق تاني) — وده بالظبط المطلوب: "مش active" بيتحسب غياب برضه
  // =====================================================
  // التعديل: بالنسبة للبوت، لا نحتاج إلى نبضات حياة (لأنه ليس لاعباً حقيقياً)
  // ولكننا نستمر في جلب الحالة لتحديث الواجهة.
  useEffect(() => {
    if (matchId == null) return;
    if (phase !== 'question' && phase !== 'waiting') return;

    if (matchState?.is_bot_match) {
      // للبوت: فقط نجلب الحالة بشكل دوري (بدون touchMatchPresence)
      let cancelled = false;
      const tick = async () => {
        if (cancelled) return;
        await fetchState();
      };
      tick();
      const interval = setInterval(tick, PRESENCE_INTERVAL_MS);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    // للاعبين الحقيقيين: نبضات حياة مع touchMatchPresence
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      await touchMatchPresence(matchId);
      if (cancelled) return;
      await fetchState();
    };

    tick(); // نبضة فورية عند دخول الشاشة، مش استنى 7 ثواني الأول
    const interval = setInterval(tick, PRESENCE_INTERVAL_MS);

    // لو رجع للتطبيق بعد ما كان في الخلفية، ابعت نبضة فوراً بدل ما
    // يستنى الـ tick الجاي — بيقلل فرصة إنه يتحسب غايب بالغلط لمجرد
    // إنه رجع في توقيت سيء
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, phase, matchState?.is_bot_match, touchMatchPresence, fetchState]);

  // تِك بصري كل ثانية بس عشان عدّاد "الخصم غير نشط منذ..." يتحرّك بسلاسة
  // من غير ما يحتاج طلب شبكة جديد كل ثانية — بيعيد حساب الفرق من
  // opponent_last_seen المخزّنة بالفعل في matchState
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (phase !== 'question' && phase !== 'waiting') return;
    if (!matchState?.opponent_last_seen || matchState?.is_bot_match) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [phase, matchState?.opponent_last_seen, matchState?.is_bot_match]);

  const opponentIdleSeconds = matchState?.opponent_last_seen
    ? Math.max(0, Math.floor((Date.now() - new Date(matchState.opponent_last_seen).getTime()) / 1000))
    : 0;
  const showInactivityWarning =
    (phase === 'question' || phase === 'waiting') &&
    !matchState?.is_bot_match &&
    matchState?.opponent_last_seen &&
    opponentIdleSeconds >= INACTIVITY_WARNING_SECONDS;
  const secondsUntilForfeit = Math.max(0, FORFEIT_THRESHOLD_SECONDS - opponentIdleSeconds);

  const handleAccept = async () => {
    const { error } = await acceptFriendlyMatch(matchId);
    if (error) { console.error('❌', error); navigateTo('vs-lobby'); return; }
    await fetchState();
  };

  const handleDecline = async () => {
    await declineFriendlyMatch(matchId);
    navigateTo('vs-lobby');
  };

  // =========== واجهات الحالات المختلفة ===========

  if (phase === 'loading' || !matchState) {
    return (
      <AppWrapper>
        <Header showBack={true} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">⚔️</div>
        </main>
      </AppWrapper>
    );
  }

  if (phase === 'invite') {
    return (
      <AppWrapper>
        <Header showBack={true} />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <div className="text-5xl">⚔️</div>
          <p className="font-black text-lg" style={{ color: '#3D2B1F' }}>دعوة لمباراة ودّية!</p>
          <div className="flex gap-3 w-full max-w-xs mt-2">
            <button onClick={handleDecline} className="flex-1 py-3 rounded-xl font-bold" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
              رفض
            </button>
            <button onClick={handleAccept} className="flex-1 py-3 rounded-xl font-bold text-white" style={{ backgroundColor: '#2D6A3F' }}>
              قبول والبدء
            </button>
          </div>
        </main>
      </AppWrapper>
    );
  }

  if (phase === 'waiting') {
    return (
      <AppWrapper>
        <Header showBack={true} />
        <main className="flex-1 flex flex-col justify-center px-5" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <DuelBar
            userProfile={userProfile}
            matchState={matchState}
            showInactivityWarning={showInactivityWarning}
            secondsUntilForfeit={secondsUntilForfeit}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-3xl animate-pulse">⏳</div>
            <p className="font-bold text-sm" style={{ color: '#3D2B1F' }}>خلّصت أسئلتك! مستني خصمك يخلّص...</p>
          </div>
        </main>
      </AppWrapper>
    );
  }

  if (phase === 'result') {
    const won = matchState.winner_id === userProfile.id;
    const isVoid = matchState.end_reason === 'void';
    const isDraw = !matchState.winner_id && matchState.status === 'finished' && !isVoid;
    const isForfeit = matchState.end_reason === 'forfeit';
    const myChange = isPlayer1 ? matchState.player_1_rating_change : matchState.player_2_rating_change;

    let icon = '😔';
    let title = 'خسرت';
    let subtitle = null;
    if (matchState.status === 'declined') {
      icon = '😕'; title = 'الدعوة اتّرفضت';
    } else if (isVoid) {
      // مفيش خصم حقيقي استحق الفوز فعلياً (مباراة بوت اتسابت، أو
      // الطرفين غايبين مع بعض) — مفيش فايز ولا خاسر ولا تأثير تصنيف
      icon = '🤷'; title = 'اتلغت المباراة';
      subtitle = 'الطرفين ما كملوش، فمفيش تأثير على تصنيفك';
    } else if (isForfeit) {
      icon = won ? '🏳️' : '🚪';
      title = won ? 'فزت بالتحدي!' : 'انتهى التحدي';
      subtitle = won ? 'الخصم انسحب أو اتأخر أكتر من 30 ثانية' : 'ما كنتش نشط لفترة طويلة، فاحتسبنا خسارة';
    } else if (won) {
      icon = '🏆'; title = 'فزت!';
    } else if (isDraw) {
      icon = '🤝'; title = 'تعادل';
    }

    return (
      <AppWrapper>
        <Header showBack={true} />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <div className="text-6xl">{icon}</div>
          <p className="font-black text-xl" style={{ color: '#3D2B1F' }}>{title}</p>
          {subtitle && (
            <p className="text-xs font-semibold" style={{ color: '#8B5A2B' }}>{subtitle}</p>
          )}
          {myChange != null && !isVoid && (
            <p className="text-sm font-bold" style={{ color: myChange >= 0 ? '#2D6A3F' : '#DC2626' }}>
              التصنيف: {myChange >= 0 ? '+' : ''}{myChange}
            </p>
          )}
          <button
            onClick={() => navigateTo('vs-lobby')}
            className="mt-4 px-6 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: '#C8922A' }}
          >
            العودة للبوابة
          </button>
        </main>
      </AppWrapper>
    );
  }

  // phase === 'question' — السؤال الحالي مع العدّ التنازلي
  const timerPct = matchState.question_time_limit_seconds > 0
    ? (timeLeft / matchState.question_time_limit_seconds) * 100
    : 0;
  const timerColor = timeLeft <= 5 ? '#DC2626' : timeLeft <= 10 ? '#F59E0B' : '#2D6A3F';

  return (
    <AppWrapper>
      <Header showBack={true} />
      <main className="flex-1 flex flex-col px-5 pb-8" style={{ fontFamily: "'Cairo', sans-serif" }}>

        {/* شريط المعلومات: السؤال + العدّ التنازلي */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: '#8B5A2B' }}>
            سؤال {(matchState.current_question_index ?? 0) + 1} / {matchState.total_questions}
          </span>
          <span className="text-sm font-black" style={{ color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
            {timeLeft}s
          </span>
        </div>

        {/* شريط التقدم الملوّن */}
        <div className="w-full h-1.5 rounded-full mb-4" style={{ backgroundColor: 'rgba(200,146,42,0.15)' }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
          />
        </div>

        {/* بطاقتا أنت/الخصم — بتشتغل بنفس الشكل للبوت وللإنسان */}
        <DuelBar
          userProfile={userProfile}
          matchState={matchState}
          showInactivityWarning={showInactivityWarning}
          secondsUntilForfeit={secondsUntilForfeit}
        />

        {matchState.question && (
          <>
            <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'white', border: '1px solid rgba(200,146,42,0.2)' }}>
              <p className="font-bold text-sm leading-relaxed" style={{ color: '#3D2B1F' }}>{matchState.question}</p>
            </div>

            <div className="space-y-2.5">
              {matchState.options.map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                const showFeedback = lastAnswerCorrect !== null;
                const isRight = showFeedback && lastAnswerCorrect && isSelected;
                const isWrong = showFeedback && !lastAnswerCorrect && isSelected;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (hasSubmittedRef.current) return;
                      setSelectedIndex(idx);
                    }}
                    disabled={hasSubmittedRef.current}
                    className="w-full text-right px-4 py-3.5 rounded-xl font-semibold text-sm press-effect no-tap-highlight"
                    style={{
                      backgroundColor: isRight ? 'rgba(45,106,63,0.15)' : isWrong ? 'rgba(220,38,38,0.1)' : isSelected ? 'rgba(200,146,42,0.08)' : 'white',
                      border: `2px solid ${isRight ? '#2D6A3F' : isWrong ? '#DC2626' : isSelected ? '#C8922A' : 'rgba(200,146,42,0.2)'}`,
                      color: '#3D2B1F',
                      opacity: hasSubmittedRef.current ? 0.6 : 1,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {selectedIndex !== null && !hasSubmittedRef.current && (
              <button
                onClick={() => handleSubmit(false)}
                className="w-full mt-6 py-3.5 rounded-2xl font-bold text-white"
                style={{ backgroundColor: '#C8922A' }}
              >
                تأكيد الإجابة
              </button>
            )}
          </>
        )}
      </main>
    </AppWrapper>
  );
}

export default VsMatchPage;