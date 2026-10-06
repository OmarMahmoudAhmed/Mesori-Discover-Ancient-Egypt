import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const listeners = {};
  const m = {
    isNative: vi.fn(),
    getAdConfig: vi.fn(),
    listeners,
    emit: (event, payload) => (listeners[event] || []).slice().forEach((fn) => fn(payload)),
    AdMob: {},
  };
  m.AdMob = {
    initialize: vi.fn(),
    requestConsentInfo: vi.fn(),
    showConsentForm: vi.fn(),
    showPrivacyOptionsForm: vi.fn(),
    prepareInterstitial: vi.fn(),
    showInterstitial: vi.fn(),
    prepareRewardVideoAd: vi.fn(),
    showRewardVideoAd: vi.fn(),
    addListener: vi.fn(async (event, fn) => {
      (listeners[event] ||= []).push(fn);
      return { remove: vi.fn(() => { listeners[event] = (listeners[event] || []).filter((f) => f !== fn); }) };
    }),
  };
  return m;
});

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: h.isNative } }));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: h.AdMob,
  AdmobConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED', REQUIRED: 'REQUIRED', UNKNOWN: 'UNKNOWN' },
  InterstitialAdPluginEvents: { Dismissed: 'interstitialAdDismissed', FailedToShow: 'interstitialAdFailedToShow' },
  RewardAdPluginEvents: { Rewarded: 'onRewardedVideoAdReward', Dismissed: 'onRewardedVideoAdDismissed', FailedToShow: 'onRewardedVideoAdFailedToShow' },
  MaxAdContentRating: { General: 'General', ParentalGuidance: 'ParentalGuidance', Teen: 'Teen', MatureAudience: 'MatureAudience' },
}));
vi.mock('./adConfig', () => ({ getAdConfig: h.getAdConfig }));

import {
  initAds,
  maybeShowInterstitial,
  showRewardedAd,
  openPrivacyOptions,
  isPrivacyOptionsRequired,
  isUnderAgeOfConsent,
  __resetAdsForTests,
} from './ads';

const ON = { enableAds: true, testMode: true, interstitialAdId: 'ca-app-pub-3940256099942544/1033173712', rewardedAdId: 'ca-app-pub-3940256099942544/5224354917', cooldownMinutes: 3 };
const MIN = 60 * 1000;
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T10:00:00Z'));
  Object.keys(h.listeners).forEach((k) => delete h.listeners[k]);
  Object.values(h.AdMob).forEach((fn) => fn.mockClear?.());
  h.isNative.mockReturnValue(true);
  h.getAdConfig.mockResolvedValue({ ...ON });
  h.AdMob.initialize.mockResolvedValue(undefined);
  h.AdMob.requestConsentInfo.mockResolvedValue({ status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  h.AdMob.showConsentForm.mockResolvedValue({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
  h.AdMob.showPrivacyOptionsForm.mockResolvedValue(undefined);
  h.AdMob.prepareInterstitial.mockResolvedValue({ adUnitId: 'x' });
  h.AdMob.showInterstitial.mockResolvedValue(undefined);
  h.AdMob.prepareRewardVideoAd.mockResolvedValue({ adUnitId: 'x' });
  h.AdMob.showRewardVideoAd.mockImplementation(() => new Promise(() => {})); // الواقع: لا يُحلّ إلا عند المكافأة
  __resetAdsForTests();
});
afterEach(() => vi.useRealTimers());

/** نجهّز الإعلان البيني ونتخطى فترة السماح بعد فتح التطبيق */
async function readyAfterCooldown() {
  expect(await initAds()).toBe(true);
  await flush();
  vi.setSystemTime(Date.now() + 4 * MIN);
}

describe('ويب (غير native)', () => {
  beforeEach(() => h.isNative.mockReturnValue(false));
  it('كل شيء no-op ولا يلمس الـ plugin', async () => {
    expect(await initAds({ age: 20 })).toBe(false);
    expect(await maybeShowInterstitial()).toBe('not-native');
    expect(await showRewardedAd()).toEqual({ rewarded: false, reason: 'not-native' });
    expect(await openPrivacyOptions()).toBe(false);
    expect(h.AdMob.initialize).not.toHaveBeenCalled();
    expect(h.AdMob.requestConsentInfo).not.toHaveBeenCalled();
  });
});

describe('initAds', () => {
  it('Kill Switch مقفول → لا موافقة ولا تهيئة للـ SDK', async () => {
    h.getAdConfig.mockResolvedValue({ ...ON, enableAds: false });
    expect(await initAds()).toBe(false);
    expect(h.AdMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(h.AdMob.initialize).not.toHaveBeenCalled();
  });

  it('يهيّئ بحد محتوى Teen ومن غير وسم TFUA للبالغين', async () => {
    expect(await initAds({ age: 20 })).toBe(true);
    expect(h.AdMob.initialize).toHaveBeenCalledWith({ maxAdContentRating: 'Teen' });
    expect(h.AdMob.requestConsentInfo).toHaveBeenCalledWith({});
  });

  it('مستخدم أقل من 16 → وسم under-age في الموافقة والتهيئة', async () => {
    expect(await initAds({ age: 14 })).toBe(true);
    expect(h.AdMob.requestConsentInfo).toHaveBeenCalledWith({ tagForUnderAgeOfConsent: true });
    expect(h.AdMob.initialize).toHaveBeenCalledWith({ maxAdContentRating: 'Teen', tagForUnderAgeOfConsent: true });
    expect(isUnderAgeOfConsent(15)).toBe(true);
    expect(isUnderAgeOfConsent(16)).toBe(false);
    expect(isUnderAgeOfConsent(undefined)).toBe(false);
    expect(isUnderAgeOfConsent(null)).toBe(false);
  });

  it('الموافقة مطلوبة والنموذج متاح → يعرضه، ويظهر خيار الخصوصية', async () => {
    h.AdMob.requestConsentInfo.mockResolvedValue({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    expect(await initAds()).toBe(true);
    expect(h.AdMob.showConsentForm).toHaveBeenCalledTimes(1);
    expect(isPrivacyOptionsRequired()).toBe(true);
  });

  it('المستخدم لم يوافق (canRequestAds=false) → لا تهيئة', async () => {
    h.AdMob.requestConsentInfo.mockResolvedValue({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    h.AdMob.showConsentForm.mockResolvedValue({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    expect(await initAds()).toBe(false);
    expect(h.AdMob.initialize).not.toHaveBeenCalled();
  });

  it('فشل سؤال الموافقة → لا تهيئة ولا يرمي، وتتكرر المحاولة لاحقاً', async () => {
    h.AdMob.requestConsentInfo.mockRejectedValueOnce(new Error('network'));
    expect(await initAds()).toBe(false);
    expect(h.AdMob.initialize).not.toHaveBeenCalled();
    expect(await initAds()).toBe(true); // المحاولة التالية تنجح
  });

  it('idempotent: تهيئة واحدة حتى مع استدعاءات متزامنة', async () => {
    await Promise.all([initAds(), initAds(), initAds()]);
    await initAds();
    expect(h.AdMob.initialize).toHaveBeenCalledTimes(1);
  });

  it('خطأ في تهيئة الـ SDK → false ولا يرمي', async () => {
    h.AdMob.initialize.mockRejectedValue(new Error('sdk'));
    await expect(initAds()).resolves.toBe(false);
  });
});

describe('maybeShowInterstitial', () => {
  it('لا يظهر فور فتح التطبيق (فاصل من لحظة الفتح)', async () => {
    expect(await initAds()).toBe(true);
    await flush();
    expect(await maybeShowInterstitial()).toBe('cooldown');
    expect(h.AdMob.showInterstitial).not.toHaveBeenCalled();
  });

  it('بعد الفاصل ومع إعلان محمّل مسبقاً → يظهر', async () => {
    await readyAfterCooldown();
    expect(await maybeShowInterstitial()).toBe('shown');
    expect(h.AdMob.prepareInterstitial).toHaveBeenCalledWith({ adId: ON.interstitialAdId, isTesting: true });
    expect(h.AdMob.showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('بعد ظهور إعلان: يلتزم بالفاصل الزمني (لا إعلان ثانٍ فوراً)', async () => {
    await readyAfterCooldown();
    expect(await maybeShowInterstitial()).toBe('shown');
    h.emit('interstitialAdDismissed');
    await flush();
    expect(await maybeShowInterstitial()).toBe('cooldown');
    vi.setSystemTime(Date.now() + 3 * MIN + 1000);
    expect(await maybeShowInterstitial()).toBe('shown');
  });

  it('عند الإغلاق يحمّل الإعلان التالي مسبقاً', async () => {
    await readyAfterCooldown();
    await maybeShowInterstitial();
    h.AdMob.prepareInterstitial.mockClear();
    h.emit('interstitialAdDismissed');
    await flush();
    expect(h.AdMob.prepareInterstitial).toHaveBeenCalledTimes(1);
  });

  it('لو الإعلان غير محمّل → يتخطى (لا ينتظر المستخدم) ويبدأ التحميل', async () => {
    h.AdMob.prepareInterstitial.mockRejectedValueOnce(new Error('no fill'));
    expect(await initAds()).toBe(true);
    await flush();
    vi.setSystemTime(Date.now() + 4 * MIN);
    expect(await maybeShowInterstitial()).toBe('not-loaded');
    expect(h.AdMob.showInterstitial).not.toHaveBeenCalled();
    await flush();
    expect(h.AdMob.prepareInterstitial).toHaveBeenCalledTimes(2);
  });

  it('الإعلان المحمّل القديم (> 55 دقيقة) لا يُعرض', async () => {
    await readyAfterCooldown();
    vi.setSystemTime(Date.now() + 56 * MIN);
    expect(await maybeShowInterstitial()).toBe('not-loaded');
  });

  it('Kill Switch يوقف العرض فوراً حتى بعد التهيئة', async () => {
    await readyAfterCooldown();
    h.getAdConfig.mockResolvedValue({ ...ON, enableAds: false });
    expect(await maybeShowInterstitial()).toBe('disabled');
    expect(h.AdMob.showInterstitial).not.toHaveBeenCalled();
  });

  it('بدون معرّف وحدة (إنتاج بمعرّف غير صالح) → no-ad-unit', async () => {
    h.getAdConfig.mockResolvedValue({ ...ON, testMode: false, interstitialAdId: null });
    expect(await maybeShowInterstitial()).toBe('no-ad-unit');
  });

  it('الفاصل الزمني من الإعدادات عن بُعد', async () => {
    h.getAdConfig.mockResolvedValue({ ...ON, cooldownMinutes: 10 });
    await readyAfterCooldown(); // +4 دقائق فقط
    expect(await maybeShowInterstitial()).toBe('cooldown');
    vi.setSystemTime(Date.now() + 7 * MIN);
    expect(await maybeShowInterstitial()).toBe('shown');
  });

  it('فشل العرض لا يرمي ويفرّج الحالة', async () => {
    await readyAfterCooldown();
    h.AdMob.showInterstitial.mockRejectedValueOnce(new Error('boom'));
    expect(await maybeShowInterstitial()).toBe('error');
    h.emit('interstitialAdFailedToShow');
    vi.setSystemTime(Date.now() + 4 * MIN);
    await flush();
    expect(await maybeShowInterstitial()).not.toBe('busy');
  });
});

describe('showRewardedAd', () => {
  it('المستخدم أكمل الإعلان → rewarded=true بالقيمة', async () => {
    const p = showRewardedAd();
    await flush();
    h.emit('onRewardedVideoAdReward', { type: 'coins', amount: 10 });
    h.emit('onRewardedVideoAdDismissed');
    await expect(p).resolves.toEqual({ rewarded: true, amount: 10, type: 'coins' });
    expect(h.AdMob.prepareRewardVideoAd).toHaveBeenCalledWith({ adId: ON.rewardedAdId, isTesting: true });
  });

  it('أغلقه قبل المكافأة → rewarded=false ولا يتعلّق (الـ promise الأصلي لا يُحلّ)', async () => {
    const p = showRewardedAd();
    await flush();
    h.emit('onRewardedVideoAdDismissed');
    await expect(p).resolves.toEqual({ rewarded: false, reason: 'dismissed' });
  });

  it('فشل عرض الإعلان → show-failed', async () => {
    const p = showRewardedAd();
    await flush();
    h.emit('onRewardedVideoAdFailedToShow');
    await expect(p).resolves.toEqual({ rewarded: false, reason: 'show-failed' });
  });

  it('فشل التحميل → load-failed', async () => {
    h.AdMob.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'));
    await expect(showRewardedAd()).resolves.toEqual({ rewarded: false, reason: 'load-failed' });
  });

  it('Kill Switch / بدون معرّف / SDK غير جاهز', async () => {
    h.getAdConfig.mockResolvedValue({ ...ON, enableAds: false });
    expect(await showRewardedAd()).toEqual({ rewarded: false, reason: 'disabled' });
    h.getAdConfig.mockResolvedValue({ ...ON, testMode: false, rewardedAdId: null });
    expect(await showRewardedAd()).toEqual({ rewarded: false, reason: 'no-ad-unit' });
    h.getAdConfig.mockResolvedValue({ ...ON });
    h.AdMob.initialize.mockRejectedValue(new Error('sdk'));
    expect(await showRewardedAd()).toEqual({ rewarded: false, reason: 'not-ready' });
  });

  it('لا يسمح بإعلانين متزامنين، وينظّف المستمعين بعد الانتهاء', async () => {
    const p1 = showRewardedAd();
    await flush();
    expect(await showRewardedAd()).toEqual({ rewarded: false, reason: 'busy' });
    h.emit('onRewardedVideoAdDismissed');
    await p1;
    expect(h.listeners.onRewardedVideoAdReward || []).toHaveLength(0);
    expect(h.listeners.onRewardedVideoAdDismissed || []).toHaveLength(0);
    // وبعد الانتهاء يمكن عرض غيره
    const p2 = showRewardedAd();
    await flush();
    h.emit('onRewardedVideoAdDismissed');
    expect((await p2).reason).toBe('dismissed');
  });

  it('مهلة أمان: لو لم يصل أي حدث لا يتعلّق للأبد', async () => {
    const p = showRewardedAd();
    await flush();
    await vi.advanceTimersByTimeAsync(5 * MIN + 1000);
    await expect(p).resolves.toEqual({ rewarded: false, reason: 'timeout' });
  });
});

describe('خيارات الخصوصية', () => {
  it('openPrivacyOptions يعمل بعد التهيئة فقط ولا يرمي', async () => {
    expect(await openPrivacyOptions()).toBe(false); // قبل التهيئة
    await initAds();
    expect(await openPrivacyOptions()).toBe(true);
    h.AdMob.showPrivacyOptionsForm.mockRejectedValueOnce(new Error('x'));
    expect(await openPrivacyOptions()).toBe(false);
  });
});
