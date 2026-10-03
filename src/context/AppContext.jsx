/*
 * =====================================================
 * AppContext.jsx - قلب التطبيق وذاكرته المشتركة
 * =====================================================
 *
 * ما هو React Context؟
 * تخيّل Context كـ "إذاعة" داخل التطبيق:
 * - AppProvider = محطة البث (تُرسل البيانات)
 * - useApp()    = راديو (أي مكوّن يريد الاستماع)
 *
 * خارطة البيانات المُدارة هنا:
 * ┌─────────────────────────────────────────┐
 * │  session       → جلسة Supabase Auth الحالية│
 * │  userProfile   → بيانات المستخدم (من profiles)│
 * │  levelsData    → تقدّم المستويات/المراحل│
 * │  completeStage()→ إنهاء مرحلة + فتح التالية│
 * │  signUp/signIn/signOut/completeOnboarding│
 * │  isSoundOn     → حالة الصوت            │
 * │  currentPage   → الصفحة الحالية        │
 * │  pageData      → بيانات الصفحة         │
 * │  navigateTo()  → دالة التنقل           │
 * │  goBack()      → دالة الرجوع           │
 * │  progressPct   → نسبة التقدم الكلي     │
 * └─────────────────────────────────────────┘
 *
 * تسلسل التحميل عند فتح التطبيق:
 * 1) authLoading: فحص هل فيه جلسة دخول محفوظة (Supabase يحفظها محلياً)
 * 2) لو فيه جلسة: profileLoading يجيب صف profiles + رتبة المستخدم
 * 3) بالتوازي (بلا انتظار الجلسة): تحميل levels/stages/questions
 *    (محتوى عام، متاح للجميع بلا تسجيل دخول)
 * 4) بمجرد ما (2) و(3) يخلصوا الاثنين: تُطبَّق مراحل المستخدم
 *    المكتملة سابقاً (user_progress) فوق بنية المحتوى، فتظهر
 *    المراحل المفتوحة/المكتملة صح من أول ثانية بعد تسجيل الدخول
 * =====================================================
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { levelsData as initialLevelsData } from '../data/levels';
import { supabase } from '../lib/supabaseClient';

/*
 * تُعيد حساب حالة "مفتوحة/مقفولة" لكل مستوى ومرحلة من الصفر بناءً
 * على isCompleted فقط (مصدر الحقيقة الوحيد). تُستخدم في مكانين:
 * حساب أولي عند تحميل تقدّم قديم من user_progress، وبعد كل
 * completeStage() (بدل منطق فتح يدوي مبعثر في كل مكان).
 */
function computeUnlockedLevels(levelsWithCompletion) {
  return levelsWithCompletion.map((level, levelIdx) => {
    const prevLevel = levelIdx > 0 ? levelsWithCompletion[levelIdx - 1] : null;
    const levelUnlocked = levelIdx === 0 || (prevLevel ? prevLevel.stages.every(s => s.isCompleted) : false);

    const stages = level.stages.map((stage, stageIdx) => ({
      ...stage,
      isUnlocked: stageIdx === 0 ? levelUnlocked : level.stages[stageIdx - 1].isCompleted,
    }));

    return {
      ...level,
      isUnlocked: levelUnlocked,
      stages,
      earnedPoints: stages.reduce((sum, s) => sum + s.earnedPoints, 0),
    };
  });
}

/* تطبّق صفوف user_progress (من قاعدة البيانات) فوق بنية المحتوى */
function applyProgressOverlay(levels, progressRows) {
  const progressMap = new Map(progressRows.map(p => [`${p.level_id}-${p.stage_id}`, p]));
  const withCompletion = levels.map(level => ({
    ...level,
    stages: level.stages.map(stage => {
      const p = progressMap.get(`${level.id}-${stage.id}`);
      return { ...stage, isCompleted: p?.is_completed ?? false, earnedPoints: p?.best_score ?? 0 };
    }),
  }));
  return computeUnlockedLevels(withCompletion);
}

const AppContext = createContext(null);

export function AppProvider({ children }) {

  // ---- حالة الصوت ----
  const [isSoundOn, setIsSoundOn] = useState(true);

  // ---- جلسة Supabase Auth ----
  const [session,      setSession]      = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);  // فحص الجلسة المحفوظة عند فتح التطبيق
  const [profileLoading, setProfileLoading] = useState(true);
  const [contentLoaded,  setContentLoaded]  = useState(false); // هل levels/stages اتحمّلوا من Supabase؟

  // ---- بيانات المستخدم (تُملأ فعلياً من profiles بعد تسجيل الدخول) ----
  const [userProfile, setUserProfile] = useState({
    id:                  null,
    name:                'مكتشف',
    age:                 null,
    country:             'مصر',
    countryFlag:         '🇪🇬',
    character:           'boy',
    gender:              null,   // 'male' | 'female' | null — منفصل تماماً عن الأفاتار المُختار
    currentLevel:        1,
    completedStages:     0,
    totalPoints:         0,
    rank:                null,
    onboardingCompleted: false,
    rating:              1000,  // تصنيف 1 ضد 1 (ELO)
    vsWins:               0,
    vsLosses:             0,
    vsDraws:              0,
  });

  // ---- حالة المستويات والمراحل ----
  const [levels, setLevels] = useState(initialLevelsData);

  // ---- الشارات المكتسبة ----
  const [userBadges, setUserBadges] = useState([]); // [{id, title_ar, description_ar, icon, earned_at}]

  // ---- الإشعارات ----
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  // ---- نظام التنقل ----
  const [currentPage, setCurrentPage] = useState('home');
  const [pageData,    setPageData]    = useState(null);
  const [navHistory, setNavHistory] = useState(['home']);

  // =============================================
  // إدارة جلسة الدخول (Supabase Auth)
  // =============================================
  useEffect(() => {
    // 1) فحص هل فيه جلسة محفوظة من زيارة سابقة (Supabase بيحفظها في localStorage تلقائياً)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) setProfileLoading(false); // مفيش جلسة = مفيش بروفايل ننتظره
    });

    // 2) الاستماع لأي تغيير لاحق (تسجيل دخول/خروج/تجديد الجلسة تلقائياً)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        // تسجيل خروج: رجّع البروفايل لحالة فارغة آمنة (الصفحة هترجع لـ Login فوراً)
        setProfileLoading(true);
        setUserProfile(prev => ({ ...prev, id: null, onboardingCompleted: false }));
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // =============================================
  // تحميل بيانات البروفايل + الترتيب بعد تسجيل الدخول
  // =============================================
  useEffect(() => {
    if (!session?.user?.id) return;

    async function loadProfile() {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          // أول تسجيل قد يسبق الـ trigger بجزء من الثانية في حالات نادرة
          console.error('❌ خطأ في تحميل البروفايل:', error);
          return;
        }

        // الترتيب اختياري (يظهر بس لو المستخدم دخل الـ leaderboard، أي بعد onboarding)
        let rank = null;
        if (data.onboarding_completed) {
          const { data: rankRow } = await supabase
            .from('leaderboard')
            .select('rank')
            .eq('id', session.user.id)
            .maybeSingle();
          rank = rankRow?.rank ?? null;
        }

        setUserProfile(prev => ({
          ...prev,
          id:                  data.id,
          name:                data.username,
          age:                 data.age,
          country:             data.country || 'مصر',
          countryFlag:         data.country_flag || '🇪🇬',
          character:           data.character,
          gender:              data.gender,
          totalPoints:         data.total_points,
          onboardingCompleted: data.onboarding_completed,
          rating:              data.rating,
          vsWins:              data.vs_wins,
          vsLosses:            data.vs_losses,
          vsDraws:             data.vs_draws,
          rank,
        }));
      } catch (err) {
        console.error('❌ خطأ غير متوقع في تحميل البروفايل:', err);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [session?.user?.id]);

  // =============================================
  // تحميل المستويات والمراحل من Supabase
  // =============================================
  /*
   * الألوان ومسارات الأيقونات بصرية بحتة ولا تحتاج تخزينها في
   * قاعدة البيانات (نفس القرار الموثّق في BACKEND_GUIDE.md)، لكنها
   * لازم تختلف فعلياً حسب كل مستوى (سهل=أخضر، متوسط=فيروزي،
   * صعب=أزرق، صعب جداً=برتقالي/بني، متقدم=ذهبي) بدل قيمة واحدة
   * ثابتة لكل المستويات كما كانت — نفس القيم الأصلية من data/levels.js.
   */
  const LEVEL_PRESENTATION = {
    1: { iconSrc: '/assets/icons/levels/level-1-pyramid.png',        bgColor: '#1B5E2E', headerBg: '#143F20', textColor: '#4ADE80', iconBg: '#0F2D18', badgeBg: '#0F2D18', badgeText: '#86EFAC' },
    2: { iconSrc: '/assets/icons/levels/level-2-pharaoh-mask.png',   bgColor: '#0D7E72', headerBg: '#085E54', textColor: '#34D399', iconBg: '#054540', badgeBg: '#054540', badgeText: '#6EE7B7' },
    3: { iconSrc: '/assets/icons/levels/level-3-pillar.png',         bgColor: '#1A3A6B', headerBg: '#122848', textColor: '#60A5FA', iconBg: '#0D1E3D', badgeBg: '#0D1E3D', badgeText: '#93C5FD' },
    4: { iconSrc: '/assets/icons/levels/level-4-pharaoh-figure.png', bgColor: '#3B1A08', headerBg: '#2A1206', textColor: '#FB923C', iconBg: '#1E0D04', badgeBg: '#1E0D04', badgeText: '#FDBA74' },
    5: { iconSrc: '/assets/icons/levels/level-5-ankh-shield.png',    bgColor: '#7A5200', headerBg: '#5A3C00', textColor: '#FBBF24', iconBg: '#3D2800', badgeBg: '#3D2800', badgeText: '#FCD34D' },
  };
  const FALLBACK_PRESENTATION = LEVEL_PRESENTATION[1];

  useEffect(() => {
    async function loadLevels() {
      try {
        console.log('🔄 تحميل المستويات والمراحل من Supabase...');

        // 1. جلب المستويات مع مراحلهم
        const { data: levelsData, error: levelsError } = await supabase
          .from('levels')
          .select(`
            id,
            name_ar,
            name_en,
            difficulty,
            max_points,
            stages: stages (
              id,
              level_id,
              title,
              description,
              order_index,
              emoji
            )
          `)
          .order('id');

        if (levelsError) {
          console.error('❌ خطأ في تحميل المستويات:', levelsError);
          return;
        }

        if (!levelsData || levelsData.length === 0) {
          console.warn('⚠️ لا توجد بيانات مستويات في قاعدة البيانات. استخدم البيانات الثابتة.');
          return;
        }

        // 2. تحويل البيانات إلى الشكل المتوقع من المكونات
        const formattedLevels = levelsData.map(level => {
          // ترتيب المراحل حسب order_index
          const LEVEL_NAMES_AR = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس' };
          const stages = (level.stages || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(stage => ({
              id: stage.id,
              levelId: stage.level_id,
              title: stage.title,
              description: stage.description || '',
              emoji: stage.emoji || '📚',
              // حالة المرحلة (مقفولة/مفتوحة/مكتملة) سنحددها لاحقاً
              isUnlocked: false,
              isCompleted: false,
              earnedPoints: 0,
              // نص فتح المرحلة (يظهر بدل الوصف طالما لسه مقفولة):
              // المرحلة 1 من أي مستوى تحتاج إكمال المستوى السابق،
              // وأي مرحلة تانية تحتاج إكمال المرحلة اللي قبلها فقط
              unlockCondition: stage.id === 1
                ? `أكمل المستوى ${LEVEL_NAMES_AR[level.id - 1] || 'السابق'} لفتح هذا المستوى`
                : `أكمل المرحلة ${stage.id - 1} لفتح هذه المرحلة`,
            }));

          return {
            id: level.id,
            nameAr: level.name_ar,
            nameEn: level.name_en || `Level ${level.id}`,
            difficulty: level.difficulty,
            maxPoints: level.max_points || 100,
            totalStages: stages.length,
            isUnlocked: level.id === 1, // المستوى الأول مفتوح دائماً
            earnedPoints: 0,
            stages: stages,
            // خصائص إضافية للتنسيق (لن تُستخدم في قاعدة البيانات) —
            // تختلف فعلياً حسب كل مستوى، راجع LEVEL_PRESENTATION أعلاه
            ...(LEVEL_PRESENTATION[level.id] || FALLBACK_PRESENTATION),
            quizCount: 10,
          };
        });

        // 3. فتح المرحلة الأولى من المستوى الأول
        if (formattedLevels.length > 0 && formattedLevels[0].stages.length > 0) {
          formattedLevels[0].stages[0].isUnlocked = true;
        }

        console.log(`✅ تم تحميل ${formattedLevels.length} مستويات و ${formattedLevels.reduce((acc, l) => acc + l.stages.length, 0)} مراحل.`);
        setLevels(formattedLevels);
        setContentLoaded(true);

      } catch (error) {
        console.error('❌ خطأ غير متوقع في تحميل المستويات:', error);
      }
    }

    loadLevels();
  }, []); // [] = يتم التنفيذ مرة واحدة فقط عند تحميل المكون

  // =============================================
  // تطبيق تقدّم المستخدم السابق (user_progress) فوق المحتوى
  // =============================================
  /*
   * لازم ننتظر الاثنين معاً: المحتوى (levels/stages) والمستخدم
   * (session)، وإلا لو طبّقنا التقدّم على البيانات الثابتة المؤقتة
   * (initialLevelsData) قبل ما يوصل محتوى Supabase الحقيقي، هيجي
   * setLevels(formattedLevels) بعدها ويمسح التقدّم اللي طبّقناه.
   */
  useEffect(() => {
    if (!contentLoaded || !session?.user?.id) return;

    async function loadProgress() {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('level_id, stage_id, is_completed, best_score')
          .eq('user_id', session.user.id);

        if (error) {
          console.error('❌ خطأ في تحميل التقدّم السابق:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log(`✅ تطبيق ${data.length} مرحلة مكتملة سابقاً.`);
          setLevels(prev => applyProgressOverlay(prev, data));
        }
      } catch (err) {
        console.error('❌ خطأ غير متوقع في تحميل التقدّم:', err);
      }
    }

    loadProgress();
  }, [contentLoaded, session?.user?.id]);

  // =============================================
  // تحميل الشارات المكتسبة
  // =============================================
  useEffect(() => {
    if (!session?.user?.id) {
      setUserBadges([]);
      return;
    }

    async function loadBadges() {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at, badges (id, title_ar, description_ar, icon)')
        .eq('user_id', session.user.id)
        .order('earned_at', { ascending: false });

      if (error) {
        console.error('❌ خطأ في تحميل الشارات:', error);
        return;
      }

      setUserBadges((data || []).map(row => ({
        id:          row.badges.id,
        title:       row.badges.title_ar,
        description: row.badges.description_ar,
        icon:        row.badges.icon,
        earnedAt:    row.earned_at,
      })));
    }

    loadBadges();
  }, [session?.user?.id]);

  // =============================================
  // الإشعارات (تحميل أولي + استماع فوري لأي جديد عبر Supabase Realtime)
  // =============================================
  useEffect(() => {
    if (!session?.user?.id) {
      setNotifications([]);
      return;
    }

    async function loadNotifications() {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('❌ خطأ في تحميل الإشعارات:', error);
        return;
      }
      setNotifications(data || []);
    }

    loadNotifications();

    /*
     * اشتراك فوري: أي إشعار جديد يوصل (رسالة/شارة) يظهر فوراً بدون
     * ما المستخدم يحدّث الصفحة يدوياً — Supabase Realtime بيبعت
     * الصف الجديد مباشرة عبر WebSocket.
     */
    const channel = supabase
      .channel(`notifications-${session.user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);

        // شارة جديدة وصلت الآن؟ حدّث قائمة الشارات فوراً (بدل انتظار
        // إعادة تحميل الصفحة) عشان تظهر في صفحة البروفايل مباشرة
        if (payload.new.type === 'badge') {
          supabase
            .from('user_badges')
            .select('badge_id, earned_at, badges (id, title_ar, description_ar, icon)')
            .eq('user_id', session.user.id)
            .order('earned_at', { ascending: false })
            .then(({ data }) => {
              if (data) {
                setUserBadges(data.map(row => ({
                  id: row.badges.id, title: row.badges.title_ar,
                  description: row.badges.description_ar, icon: row.badges.icon, earnedAt: row.earned_at,
                })));
              }
            });
        }
      })
      .subscribe();

    /*
     * نبضة احترازية: الويب سوكيت بتاع Realtime ممكن ينقطع (خصوصاً على
     * الموبايل لما التطبيق يترمى في الخلفية والـ OS يوقف تنفيذ الجافا
     * سكريبت)، وRealtime مبيعملش "إعادة إرسال" للأحداث اللي فاتت وقت
     * الانقطاع — بيبعت بس لحظة حدوث الـ INSERT فعلياً. فلو رجعنا نشوف
     * الصفحة/التطبيق تاني (visible) بعد ما كان مخفي، نعمل refetch يدوي
     * عشان نلحّق أي إشعار وصل أثناء الانقطاع.
     */
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session?.user?.id]);

  // =============================================
  // تتبّع وقت الاستخدام (لشارة "10 ساعات") — نبضة كل دقيقة طالما
  // الصفحة مفتوحة وفي المقدمة، ونادراً ما تُفقد دقيقة عند الإغلاق
  // المفاجئ (مقبول لهدف شارة تقريبية، مش سجل دقيق للمحاسبة)
  // =============================================
  useEffect(() => {
    if (!session?.user?.id) return;

    const HEARTBEAT_SECONDS = 60;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        supabase.rpc('track_app_time', { p_seconds: HEARTBEAT_SECONDS })
          .then(({ error }) => { if (error) console.error('❌ فشل تتبّع وقت الاستخدام:', error); });
      }
    }, HEARTBEAT_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // =============================================
  // الدوال (Functions)
  // =============================================

  const toggleSound = useCallback(() => {
    setIsSoundOn(prev => !prev);
  }, []);

  const navigateTo = useCallback((page, data = null) => {
    setNavHistory(prev => [...prev, page]);
    setCurrentPage(page);
    setPageData(data);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const goBack = useCallback(() => {
    setNavHistory(prev => {
      if (prev.length > 1) {
        const newHistory = [...prev];
        newHistory.pop();
        const prevPage = newHistory[newHistory.length - 1];
        setCurrentPage(prevPage);
        setPageData(null);
        window.scrollTo({ top: 0, behavior: 'instant' });
        return newHistory;
      }
      return prev;
    });
  }, []);

  /*
   * تحديث أي حقل في البروفايل (الاسم/العمر/الدولة/الأفاتار) — تحديث
   * محلي فوري (تجربة استخدام سلسة) + مزامنة مع Supabase في الخلفية.
   * ⚠️ قبل كده كانت هذه الدالة محلية فقط، فتعديلات الملف الشخصي
   * (بما فيها اختيار الأفاتار) ما كانتش بتتحفظ فعلياً في القاعدة.
   */
  const FIELD_TO_COLUMN = {
    name:      'username',
    age:       'age',
    country:   'country',
    character: 'character',
    gender:    'gender',
  };

  const updateUserProfile = useCallback((updates) => {
    setUserProfile(prev => ({ ...prev, ...updates }));

    if (!session?.user?.id) return; // مسجّل خروج: تحديث محلي فقط (هيُستبدل عند أي دخول لاحق)

    const dbUpdates = {};
    Object.entries(updates).forEach(([field, value]) => {
      const column = FIELD_TO_COLUMN[field];
      if (column) dbUpdates[column] = value;
    });
    if (Object.keys(dbUpdates).length === 0) return;

    supabase.from('profiles').update(dbUpdates).eq('id', session.user.id)
      .then(({ error }) => {
        if (error) console.error('❌ فشل حفظ تعديل البروفايل:', error);
      });
  }, [session]);

  const addPoints = useCallback((points) => {
    setUserProfile(prev => ({
      ...prev,
      totalPoints: prev.totalPoints + points
    }));
  }, []);

  // =============================================
  // دوال المصادقة (Supabase Auth)
  // =============================================
  /*
   * كل دالة بترجع { error } بس (null لو نجحت) — صفحة تسجيل
   * الدخول/الحساب هي المسؤولة عن عرض رسالة الخطأ للمستخدم.
   * الملف الشخصي بيتعمل تلقائياً (Trigger في قاعدة البيانات) بمجرد
   * نجاح signUp، فمفيش داعي نعمل INSERT يدوي هنا.
   */
  const signUp = useCallback(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    // لو الإعدادات في Supabase بتطلب تأكيد بريد إلكتروني، هترجع
    // user من غير session نشطة لحد ما يضغط رابط التأكيد
    const needsEmailConfirmation = !error && data?.user && !data?.session;
    return { error, needsEmailConfirmation };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /* تُستدعى من شاشة Onboarding بعد اختيار الاسم/العمر/الشخصية/الجنس */
  const completeOnboarding = useCallback(async (name, age, character, gender) => {
    if (!session?.user?.id) {
      return { error: new Error('لا يوجد مستخدم مسجّل دخول') };
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: name, age, character, gender, onboarding_completed: true })
      .eq('id', session.user.id);

    if (!error) {
      setUserProfile(prev => ({ ...prev, name, age, character, gender, onboardingCompleted: true }));
    }
    return { error };
  }, [session]);

  // =============================================
  // نمط 1 ضد 1
  // =============================================
  const findRandomMatch = useCallback(async () => {
    const { data, error } = await supabase.rpc('find_or_create_match');
    return { matchId: data, error };
  }, []);

  const cancelMatchmaking = useCallback(async () => {
    await supabase.rpc('cancel_matchmaking');
  }, []);

  const searchUsers = useCallback(async (query) => {
    const { data, error } = await supabase.rpc('search_users_by_username', { p_query: query });
    return { users: data || [], error };
  }, []);

  const inviteFriendlyMatch = useCallback(async (opponentId) => {
    const { data, error } = await supabase.rpc('invite_friendly_match', { p_opponent_id: opponentId });
    return { matchId: data, error };
  }, []);

  const acceptFriendlyMatch = useCallback(async (matchId) => {
    const { error } = await supabase.rpc('accept_friendly_match', { p_match_id: matchId });
    return { error };
  }, []);

  const declineFriendlyMatch = useCallback(async (matchId) => {
    const { error } = await supabase.rpc('decline_friendly_match', { p_match_id: matchId });
    return { error };
  }, []);

  const getMatchDetails = useCallback(async (matchId) => {
    const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single();
    return { match: data, error };
  }, []);

  const getMatchQuestion = useCallback(async (matchId, questionIndex) => {
    const { data, error } = await supabase.rpc('get_match_question', {
      p_match_id: matchId, p_question_index: questionIndex,
    });
    return { question: data?.[0] || null, error };
  }, []);

  // الدالة الموحّدة: تجلب كل بيانات المباراة الحالية في طلب واحد
  // (سؤال + حالة إجابة اللاعبين + معلومات الانتهاء)
  const getCurrentMatchState = useCallback(async (matchId) => {
    const { data, error } = await supabase.rpc('get_current_match_state', {
      p_match_id: matchId,
    });
    return { state: data?.[0] || null, error };
  }, []);

  const submitMatchAnswer = useCallback(async (matchId, questionIndex, selectedIndex) => {
    const { data, error } = await supabase.rpc('submit_match_answer', {
      p_match_id: matchId, p_question_index: questionIndex, p_selected_index: selectedIndex,
    });
    return { isCorrect: data, error };
  }, []);

  // بعد 25-30 ثانية بحث من غير خصم حقيقي: يستبدله بوت (اللاعب ميعرفش)
  const requestBotMatch = useCallback(async () => {
    const { data, error } = await supabase.rpc('request_bot_match');
    return { matchId: data, error };
  }, []);

  // بيتقال من عميل اللاعب الإنسان نفسه على مؤقّت عشوائي (محاكاة البوت) —
  // الصح/الغلط بيتحسم في السيرفر برضه، مش هنا
  const submitBotAnswer = useCallback(async (matchId, questionIndex) => {
    const { data, error } = await supabase.rpc('submit_bot_answer', {
      p_match_id: matchId, p_question_index: questionIndex,
    });
    return { isCorrect: data, error };
  }, []);

  // نبضة حياة دورية طول ما شاشة المباراة مفتوحة وفاتحة فعلياً (foreground) —
  // لو أي لاعب فضل من غير نبضة 30 ثانية، السيرفر بيعتبره منسحب تلقائياً
  const touchMatchPresence = useCallback(async (matchId) => {
    const { error } = await supabase.rpc('touch_match_presence', { p_match_id: matchId });
    return { error };
  }, []);

  const forfeitMatch = useCallback(async (matchId) => {
    const { error } = await supabase.rpc('forfeit_abandoned_match', { p_match_id: matchId });
    return { error };
  }, []);

  // =============================================
  // الرسائل والمشاركة
  // =============================================
  const sendMessage = useCallback(async (recipientId, content) => {
    const { error } = await supabase.rpc('send_message', {
      p_recipient_id: recipientId,
      p_content: content,
    });
    return { error };
  }, []);

  /* تُستدعى من زر "شارك على واتساب" */
  const trackShare = useCallback(async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase.rpc('track_share');
    if (error) console.error('❌ فشل تسجيل المشاركة:', error);
  }, [session]);

  const markNotificationRead = useCallback(async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read_at: n.read_at || new Date().toISOString() } : n));
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
    if (error) console.error('❌ فشل تعليم الإشعار كمقروء:', error);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!session?.user?.id) return;
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('user_id', session.user.id).is('read_at', null);
    if (error) console.error('❌ فشل تعليم كل الإشعارات كمقروءة:', error);
  }, [session]);

  const completeStage = useCallback((levelId, stageId, earnedPoints) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return null;

    const stageIndex = level.stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) return null;

    const stage = level.stages[stageIndex];
    const wasFirstCompletion = !stage.isCompleted;
    const bestPoints = Math.max(stage.earnedPoints, earnedPoints);
    const pointsDelta = bestPoints - stage.earnedPoints;

    // 1) علّم المرحلة كمكتملة، 2) أعد حساب كل حالات الفتح تلقائياً
    // من الإكمال (نفس الدالة المستخدمة عند تحميل تقدّم قديم) — بدل
    // منطق فتح يدوي منفصل يسهل إن يتعارض مع بعضه بمرور الوقت.
    const withCompletion = levels.map(lv => lv.id !== levelId ? lv : {
      ...lv,
      stages: lv.stages.map((s, idx) => idx !== stageIndex ? s : { ...s, isCompleted: true, earnedPoints: bestPoints }),
    });
    const newLevels = computeUnlockedLevels(withCompletion);
    setLevels(newLevels);

    const newLevel = newLevels.find(l => l.id === levelId);
    let nextStage = null;
    let justUnlockedLevelId = null;
    if (stageIndex + 1 < newLevel.stages.length && newLevel.stages[stageIndex + 1].isUnlocked) {
      nextStage = { levelId, stageId: newLevel.stages[stageIndex + 1].id };
    } else {
      const nextLevel = newLevels.find(l => l.id === levelId + 1);
      if (nextLevel && nextLevel.isUnlocked && nextLevel.stages.length > 0) {
        nextStage = { levelId: nextLevel.id, stageId: nextLevel.stages[0].id };
        if (wasFirstCompletion) justUnlockedLevelId = nextLevel.id;
      }
    }

    setUserProfile(prev => ({
      ...prev,
      totalPoints:     prev.totalPoints + pointsDelta,
      completedStages: wasFirstCompletion ? prev.completedStages + 1 : prev.completedStages,
      currentLevel:    justUnlockedLevelId
        ? Math.min(levels.length, Math.max(prev.currentLevel, justUnlockedLevelId))
        : prev.currentLevel,
    }));

    /*
     * مزامنة مع Supabase (RPC ذرّية تحدّث user_progress + النقاط
     * معاً — راجع supabase/migrations/002_auth_and_leaderboard.sql).
     * لا تحجب الواجهة: الحالة المحلية اتحدّثت فعلاً فوق، فلو المستخدم
     * مش مسجّل دخول (أو الشبكة فصلت لحظياً) اللعب يفضل شغّال، بس
     * التقدّم مش هيتحفظ لحد ما يرجع يتصل/يسجّل دخول.
     */
    if (session?.user?.id) {
      supabase
        .rpc('record_stage_progress', { p_level_id: levelId, p_stage_id: stageId, p_score: bestPoints })
        .then(({ error }) => {
          if (error) console.error('❌ فشل حفظ التقدّم في Supabase:', error);
        });
    }

    return { wasFirstCompletion, pointsDelta, nextStage, isLastStageOverall: !nextStage };
  }, [levels, session]);

  const MAX_TOTAL_POINTS  = 500;
  const progressPercentage = Math.min(
    100,
    Math.round((userProfile.totalPoints / MAX_TOTAL_POINTS) * 100)
  );

  const contextValue = {
    // مصادقة
    session,
    authLoading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    completeOnboarding,
    // بيانات المستخدم
    userProfile,
    updateUserProfile,
    addPoints,
    levelsData: levels,
    completeStage,
    // الشارات
    userBadges,
    // الرسائل والإشعارات
    notifications,
    unreadCount,
    sendMessage,
    trackShare,
    markNotificationRead,
    markAllNotificationsRead,
    // نمط 1 ضد 1
    findRandomMatch,
    cancelMatchmaking,
    searchUsers,
    inviteFriendlyMatch,
    acceptFriendlyMatch,
    declineFriendlyMatch,
    getMatchDetails,
    getMatchQuestion,
    getCurrentMatchState,
    submitMatchAnswer,
    requestBotMatch,
    submitBotAnswer,
    touchMatchPresence,
    forfeitMatch,
    isSoundOn,
    toggleSound,
    currentPage,
    pageData,
    navigateTo,
    goBack,
    navHistory,
    progressPercentage,
    MAX_TOTAL_POINTS,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error(
      '❌ useApp() يجب استخدامه داخل <AppProvider> فقط!\n' +
      'راجع ملف App.jsx وتأكد أن المكوّن محاط بـ <AppProvider>'
    );
  }
  return context;
}