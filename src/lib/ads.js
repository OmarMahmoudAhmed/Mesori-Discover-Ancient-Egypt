/**
 * ads — إعلانات AdMob البينية فقط (بدون مكافئة وبدون بانر) عبر @capacitor-community/admob
 *
 * قواعد التصميم:
 *  - الإعلانات تشتغل على Android/iOS الأصلي فقط. على الويب كل الدوال بترجع فوراً.
 *  - مفيش أي تهيئة للـ SDK إلا لما enable_ads=true (Kill Switch من Supabase) وبعد الموافقة (UMP).
 *  - الإعلان البيني: مش بيظهر فور فتح التطبيق، ويحترم الفاصل interstitial_cooldown_min،
 *    وبيتحمّل مسبقاً (لو مش جاهز بنتخطّاه بدل ما نخلّي المستخدم ينتظر).
 *  - كل الدوال العامة آمنة: لا ترمي أخطاء أبداً (الإعلان ما يكسرش التطبيق).
 *  - لا نسجّل أي معرّفات أو بيانات مستخدم.
 */
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
} from '@capacitor-community/admob';
import { getAdConfig } from './adConfig';

/** تطبيق 13+ (راجع ageGate) → محتوى إعلاني مناسب للمراهقين كحد أقصى */
export const MAX_AD_CONTENT_RATING = MaxAdContentRating.Teen;
/** سن الموافقة الافتراضي في أوروبا (GDPR) — تحته نرسل وسم TFUA */
export const UNDER_AGE_OF_CONSENT = 16;

const INTERSTITIAL_MAX_AGE_MS = 55 * 60 * 1000; // الإعلان المحمّل بيصلح ساعة تقريباً

const isNative = () => Capacitor.isNativePlatform();

export const isUnderAgeOfConsent = (age) => Number.isFinite(age) && age < UNDER_AGE_OF_CONSENT;

/* ---------------- الحالة ---------------- */
let appStartedAt = Date.now();
let lastInterstitialAt = 0;
let ready = false;
let initInFlight = null;
let listenersAttached = false;
let underAgeFlag; // undefined | boolean — من آخر استدعاء initAds
let privacyOptionsRequired = false;

let interstitialReady = false;
let interstitialLoading = false;
let interstitialLoadedAt = 0;
let fullscreenActive = false;

/* ---------------- الموافقة (UMP) ---------------- */
async function gatherConsent(underAge) {
  try {
    let info = await AdMob.requestConsentInfo(underAge === undefined ? {} : { tagForUnderAgeOfConsent: underAge });
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    privacyOptionsRequired = info.privacyOptionsRequirementStatus === 'REQUIRED' // enum غير مُصدَّر من الحزمة;
    return info.canRequestAds !== false;
  } catch {
    // فشل سؤال الموافقة (شبكة...) → ما نطلبش إعلانات الآن، نحاول لاحقاً
    return false;
  }
}

async function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  try {
    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      fullscreenActive = false;
      interstitialReady = false;
      void preloadInterstitial();
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
      fullscreenActive = false;
      interstitialReady = false;
    });
  } catch {
    listenersAttached = false;
  }
}

/**
 * تهيئة الـ SDK مرة واحدة (idempotent). بترجع true لو جاهز لعرض الإعلانات.
 * بتتنادى بعد تسجيل الدخول وتحميل البروفايل. لو الإعلانات مقفولة → false بدون تهيئة.
 */
export async function initAds({ age } = {}) {
  try {
    if (!isNative()) return false;
    if (age !== undefined) underAgeFlag = isUnderAgeOfConsent(age) ? true : undefined;
    if (ready) return true;
    if (initInFlight) return initInFlight;

    initInFlight = (async () => {
      const config = await getAdConfig();
      if (!config.enableAds) return false;

      if (!(await gatherConsent(underAgeFlag))) return false;

      await AdMob.initialize({
        maxAdContentRating: MAX_AD_CONTENT_RATING,
        ...(underAgeFlag === true ? { tagForUnderAgeOfConsent: true } : {}),
      });
      ready = true;
      await attachListeners();
      void preloadInterstitial();
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        initInFlight = null;
      });

    return initInFlight;
  } catch {
    return false;
  }
}

/* ---------------- الإعلان البيني ---------------- */
async function preloadInterstitial() {
  if (!ready || interstitialLoading) return;
  const fresh = interstitialReady && Date.now() - interstitialLoadedAt < INTERSTITIAL_MAX_AGE_MS;
  if (fresh) return;
  interstitialLoading = true;
  interstitialReady = false;
  try {
    const config = await getAdConfig();
    if (!config.enableAds || !config.interstitialAdId) return;
    await AdMob.prepareInterstitial({ adId: config.interstitialAdId, isTesting: config.testMode });
    interstitialReady = true;
    interstitialLoadedAt = Date.now();
  } catch {
    interstitialReady = false;
  } finally {
    interstitialLoading = false;
  }
}

/**
 * يعرض إعلاناً بينياً لو الظروف مناسبة (لحظة توقف طبيعية: بعد إنهاء مرحلة مثلاً).
 * @returns {Promise<'shown'|'not-native'|'busy'|'disabled'|'no-ad-unit'|'cooldown'|'not-ready'|'not-loaded'|'error'>}
 */
export async function maybeShowInterstitial() {
  try {
    if (!isNative()) return 'not-native';
    if (fullscreenActive) return 'busy';

    const config = await getAdConfig();
    if (!config.enableAds) return 'disabled';
    // if (isAdFreeNow()) return 'ad-free'; // معلّق مع الإعلان المكافئ
    if (!config.interstitialAdId) return 'no-ad-unit';

    // الفاصل يُحسب من آخر إعلان، أو من فتح التطبيق (لا إعلان فور الفتح)
    const sinceLast = Date.now() - Math.max(lastInterstitialAt, appStartedAt);
    if (sinceLast < config.cooldownMinutes * 60 * 1000) return 'cooldown';

    if (!(await initAds())) return 'not-ready';

    const fresh = interstitialReady && Date.now() - interstitialLoadedAt < INTERSTITIAL_MAX_AGE_MS;
    if (!fresh) {
      void preloadInterstitial();
      return 'not-loaded';
    }

    fullscreenActive = true;
    interstitialReady = false;
    lastInterstitialAt = Date.now();
    await AdMob.showInterstitial(); // بيتحلّ بمجرد ظهور الإعلان؛ الإغلاق بيجي من حدث Dismissed
    return 'shown';
  } catch {
    fullscreenActive = false;
    return 'error';
  }
}

/* ---------------- خيارات الخصوصية (UMP) ---------------- */
/** هل لازم نعرض للمستخدم زر "خيارات الخصوصية" (أوروبا/UK)؟ */
export const isPrivacyOptionsRequired = () => privacyOptionsRequired;

/** يفتح نموذج تعديل الموافقة. آمن: لا يرمي. */
export async function openPrivacyOptions() {
  try {
    if (!isNative() || !ready) return false;
    await AdMob.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

/** للاختبارات فقط */
export function __resetAdsForTests() {
  appStartedAt = Date.now();
  lastInterstitialAt = 0;
  ready = false;
  initInFlight = null;
  listenersAttached = false;
  underAgeFlag = undefined;
  privacyOptionsRequired = false;
  interstitialReady = false;
  interstitialLoading = false;
  interstitialLoadedAt = 0;
  fullscreenActive = false;
}

// ================================================================
// الإعلان المكافئ: معلّق مؤقتاً (غير مستخدم حالياً، محفوظ هنا للرجوع إليه)
// لإعادة تفعيله:
//   1) أزل // من هذه الأسطر، وأضف RewardAdPluginEvents إلى استيراد '@capacitor-community/admob'
//   2) أعد تفعيل الشرط isAdFreeNow داخل maybeShowInterstitial
//   3) أعد ربط RewardedAdButton في QuizPage.jsx
// ================================================================
// const REWARDED_SAFETY_TIMEOUT_MS = 5 * 60 * 1000;
//
// /* ---------------- المكافأة (ساعة بدون إعلانات بينية) ---------------- */
// /*
//  * المكافأة محلية على الجهاز فقط، ولا تؤثر على النقاط أو الترتيب، لذلك لا تحتاج تحقق من السيرفر.
//  * الحد: 3 مكافآت في اليوم (يُحسب بتوقيت الجهاز).
//  */
// export const REWARD_AD_FREE_MS = 60 * 60 * 1000;
// export const REWARDED_DAILY_CAP = 3;
// const AD_FREE_KEY = 'mesori_ad_free_until';
// const REWARD_LOG_KEY = 'mesori_rewarded_log';
//
// const todayKey = () => new Date().toISOString().slice(0, 10);
//
// function readJson(key, fallback) {
//   try {
//     const v = JSON.parse(localStorage.getItem(key));
//     return v ?? fallback;
//   } catch {
//     return fallback;
//   }
// }
//
// function writeJson(key, value) {
//   try {
//     localStorage.setItem(key, JSON.stringify(value));
//   } catch {
//     /* التخزين غير متاح: المكافأة تبقى لهذه الجلسة فقط */
//   }
// }
//
// export function isAdFreeNow() {
//   return Number(readJson(AD_FREE_KEY, 0)) > Date.now();
// }
//
// export function rewardedUsedToday() {
//   const log = readJson(REWARD_LOG_KEY, null);
//   return log && log.day === todayKey() ? log.count : 0;
// }
//
// /** هل نعرض زر الإعلان المكافئ الآن؟ */
// export async function canShowRewardedAd() {
//   try {
//     if (!isNative()) return false;
//     if (rewardedUsedToday() >= REWARDED_DAILY_CAP) return false;
//     const config = await getAdConfig();
//     return config.enableAds && !!config.rewardedAdId;
//   } catch {
//     return false;
//   }
// }
//
// /** يُستدعى بعد أن يكمل المستخدم الإعلان المكافئ فعلاً */
// export function grantAdFreeHour() {
//   writeJson(AD_FREE_KEY, Date.now() + REWARD_AD_FREE_MS);
//   writeJson(REWARD_LOG_KEY, { day: todayKey(), count: rewardedUsedToday() + 1 });
// }
//
// /* ---------------- الإعلان المكافئ ---------------- */
// /**
//  * يعرض إعلاناً مكافئاً (المستخدم هو اللي طلبه، مثلاً بضغطة زر).
//  * @returns {Promise<{rewarded: boolean, amount?: number, type?: string, reason?: string}>}
//  *   rewarded=true فقط لو المستخدم أكمل الإعلان واستحق المكافأة.
//  *   ملاحظة: المكافأة هنا من جهة العميل. لو هتربطها بشيء يؤثر على الترتيب/النقاط الرسمية
//  *   استخدم التحقق من السيرفر (SSV) — راجع docs/ADMOB_SETUP.md.
//  */
// export async function showRewardedAd() {
//   const fail = (reason) => ({ rewarded: false, reason });
//   if (!isNative()) return fail('not-native');
//   if (fullscreenActive) return fail('busy');
//
//   const handles = [];
//   let timer;
//   try {
//     const config = await getAdConfig();
//     if (!config.enableAds) return fail('disabled');
//     if (!config.rewardedAdId) return fail('no-ad-unit');
//     if (!(await initAds())) return fail('not-ready');
//
//     fullscreenActive = true;
//     let reward = null;
//     let settle;
//     const outcome = new Promise((resolve) => {
//       settle = resolve;
//     });
//
//     handles.push(
//       await AdMob.addListener(RewardAdPluginEvents.Rewarded, (r) => {
//         reward = r;
//       }),
//       await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => settle('dismissed')),
//       await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => settle('show-failed')),
//     );
//
//     try {
//       await AdMob.prepareRewardVideoAd({ adId: config.rewardedAdId, isTesting: config.testMode });
//     } catch {
//       return fail('load-failed');
//     }
//
//     // مهم: الـ promise ده بيتحلّ بس عند استحقاق المكافأة ولا يُرفض عند الإغلاق المبكر
//     AdMob.showRewardVideoAd()
//       .then((r) => {
//         if (r && !reward) reward = r;
//       })
//       .catch(() => settle('show-failed'));
//
//     timer = setTimeout(() => settle('timeout'), REWARDED_SAFETY_TIMEOUT_MS);
//     const why = await outcome;
//
//     if (reward) return { rewarded: true, amount: reward.amount, type: reward.type };
//     return fail(why);
//   } catch {
//     return fail('error');
//   } finally {
//     clearTimeout(timer);
//     handles.forEach((h) => {
//       try {
//         h?.remove();
//       } catch {
//         /* ignore */
//       }
//     });
//     fullscreenActive = false;
//   }
// }
//
