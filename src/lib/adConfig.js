/**
 * adConfig — إعدادات الإعلانات عن بُعد (Supabase `app_config`، migration 017)
 *
 * المبادئ:
 *  - القيم الافتراضية "آمنة": الإعلانات مقفولة (enableAds=false) لو الإعدادات غير متاحة.
 *    (دليل AdMob كان بيفعّل الإعلانات بمعرّفات اختبار كـ fallback؛ في الإنتاج ده خطر
 *    إنه يظهر "Test Ad" للمستخدمين لو الشبكة فشلت، فعكسناه.)
 *  - ads_test_mode=true (الافتراضي) → معرّفات اختبار Google فقط، بغض النظر عن المعرّفات
 *    المخزّنة. بتحميك من النقر على إعلانات حقيقية أثناء التجربة (invalid traffic).
 *  - cache ساعة في الذاكرة وفي localStorage، وطلب واحد فقط في نفس الوقت.
 *  - لا ترمي أخطاء أبداً: أي فشل → آخر نسخة محفوظة أو القيم الافتراضية.
 */
import { supabase } from './supabaseClient';

/** معرّفات الاختبار الرسمية من Google (تعرض إعلانات اختبار دائماً ولا تضر الحساب) */
export const GOOGLE_TEST_AD_IDS = Object.freeze({
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
});

const AD_UNIT_ID_RE = /^ca-app-pub-\d{16}\/\d{10}$/;

export const AD_CONFIG_CACHE_KEY = 'mesori_ad_config_v1';
export const AD_CONFIG_TTL_MS = 60 * 60 * 1000; // ساعة
const FETCH_TIMEOUT_MS = 8000;

export const MIN_COOLDOWN_MIN = 1;
export const MAX_COOLDOWN_MIN = 120;

/** عند غياب الإعدادات: لا إعلانات، ولو اتفعّلت لاحقاً تبقى اختبارية */
export const SAFE_DEFAULTS = Object.freeze({
  enableAds: false,
  testMode: true,
  interstitialAdId: GOOGLE_TEST_AD_IDS.interstitial,
  rewardedAdId: GOOGLE_TEST_AD_IDS.rewarded,
  cooldownMinutes: 3,
});

const toBool = (v, fallback) => {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return fallback;
  const s = v.trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return fallback;
};

const toCooldown = (v, fallback) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_COOLDOWN_MIN, Math.max(MIN_COOLDOWN_MIN, Math.round(n)));
};

export const isValidAdUnitId = (v) => typeof v === 'string' && AD_UNIT_ID_RE.test(v.trim());

/**
 * تحويل صفوف الجدول [{key,value}] (أو كائن مسطّح) إلى إعدادات نظيفة.
 * دالة نقية (قابلة للاختبار) — أي قيمة غير صالحة ترجع للافتراضي.
 *
 * في وضع الإنتاج (testMode=false) معرّف وحدة غير صالح = إيقاف هذا النوع من الإعلانات (null)،
 * مش استبداله بمعرّف اختبار.
 */
export function parseAdConfig(input) {
  const map = Array.isArray(input)
    ? Object.fromEntries(input.filter((r) => r && typeof r.key === 'string').map((r) => [r.key, r.value]))
    : { ...(input || {}) };

  const testMode = toBool(map.ads_test_mode ?? map.testMode, SAFE_DEFAULTS.testMode);
  const enableAds = toBool(map.enable_ads ?? map.enableAds, SAFE_DEFAULTS.enableAds);
  const cooldownMinutes = toCooldown(
    map.interstitial_cooldown_min ?? map.cooldownMinutes,
    SAFE_DEFAULTS.cooldownMinutes,
  );

  const pick = (remote, testId) => {
    if (testMode) return testId;
    const id = typeof remote === 'string' ? remote.trim() : '';
    return isValidAdUnitId(id) ? id : null;
  };

  return {
    enableAds,
    testMode,
    interstitialAdId: pick(map.interstitial_ad_id ?? map.interstitialAdId, GOOGLE_TEST_AD_IDS.interstitial),
    rewardedAdId: pick(map.rewarded_ad_id ?? map.rewardedAdId, GOOGLE_TEST_AD_IDS.rewarded),
    cooldownMinutes,
  };
}

/* ---------------- cache ---------------- */
let memory = null; // { config, at }
let inFlight = null;

const readStored = () => {
  try {
    const raw = localStorage.getItem(AD_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.at !== 'number' || !parsed.config) return null;
    // نعيد تنقيتها (لو حد عدّل القيمة يدوياً أو اتغيّر شكل الإعدادات بين الإصدارات)
    return { config: parseAdConfig(parsed.config), at: parsed.at };
  } catch {
    return null;
  }
};

const writeStored = (entry) => {
  try {
    localStorage.setItem(AD_CONFIG_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* التخزين غير متاح: لا مشكلة */
  }
};

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function fetchRemote() {
  const { data, error } = await withTimeout(
    supabase.from('app_config').select('key, value'),
    FETCH_TIMEOUT_MS,
  );
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('bad-response');
  return parseAdConfig(data);
}

/**
 * الإعدادات الحالية. دايماً بترجع كائن صالح (لا ترمي).
 * @param {{force?: boolean}} [opts] force = تجاهل الـ cache
 */
export async function getAdConfig({ force = false } = {}) {
  const now = Date.now();

  if (!force && memory && now - memory.at < AD_CONFIG_TTL_MS) return memory.config;

  if (!force) {
    const stored = readStored();
    if (stored && now - stored.at < AD_CONFIG_TTL_MS) {
      memory = stored;
      return stored.config;
    }
  }

  if (!inFlight) {
    inFlight = fetchRemote()
      .then((config) => {
        memory = { config, at: Date.now() };
        writeStored(memory);
        return config;
      })
      .catch((err) => {
        console.warn('[ads] تعذّر جلب إعدادات الإعلانات، استخدام آخر نسخة/القيم الآمنة:', err?.message ?? err);
        // نسخة قديمة أفضل من لا شيء؛ وإلا القيم الآمنة (إعلانات مقفولة).
        // نسجّل وقت المحاولة الفاشلة كي لا نعيد الطلب مع كل استدعاء (نعيد المحاولة بعد دقيقتين).
        const fallback = (memory ?? readStored())?.config ?? parseAdConfig(SAFE_DEFAULTS);
        memory = { config: fallback, at: Date.now() - (AD_CONFIG_TTL_MS - 2 * 60 * 1000) };
        return fallback;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** للاختبارات فقط */
export function __resetAdConfigForTests() {
  memory = null;
  inFlight = null;
  try {
    localStorage.removeItem(AD_CONFIG_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
