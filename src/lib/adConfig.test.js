import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(() => ({ select: mocks.select })) },
}));

import {
  parseAdConfig,
  getAdConfig,
  isValidAdUnitId,
  SAFE_DEFAULTS,
  GOOGLE_TEST_AD_IDS,
  AD_CONFIG_CACHE_KEY,
  AD_CONFIG_TTL_MS,
  __resetAdConfigForTests,
} from './adConfig';

const REAL_INT = 'ca-app-pub-1234567890123456/1234567890';
const REAL_REW = 'ca-app-pub-1234567890123456/0987654321';
const rows = (o) => Object.entries(o).map(([key, value]) => ({ key, value }));

beforeEach(() => {
  __resetAdConfigForTests();
  mocks.select.mockReset();
  vi.useRealTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('parseAdConfig', () => {
  it('الافتراضي آمن: إعلانات مقفولة + وضع اختبار', () => {
    const c = parseAdConfig([]);
    expect(c.enableAds).toBe(false);
    expect(c.testMode).toBe(true);
    expect(c.interstitialAdId).toBe(GOOGLE_TEST_AD_IDS.interstitial);
    expect(c.rewardedAdId).toBe(GOOGLE_TEST_AD_IDS.rewarded);
    expect(c.cooldownMinutes).toBe(5);
  });

  it('في وضع الاختبار يتجاهل المعرّفات الحقيقية ويستخدم معرّفات Google', () => {
    const c = parseAdConfig(rows({ enable_ads: 'true', ads_test_mode: 'true', interstitial_ad_id: REAL_INT, rewarded_ad_id: REAL_REW }));
    expect(c.enableAds).toBe(true);
    expect(c.interstitialAdId).toBe(GOOGLE_TEST_AD_IDS.interstitial);
    expect(c.rewardedAdId).toBe(GOOGLE_TEST_AD_IDS.rewarded);
  });

  it('في وضع الإنتاج يستخدم المعرّفات الحقيقية', () => {
    const c = parseAdConfig(rows({ enable_ads: 'true', ads_test_mode: 'false', interstitial_ad_id: REAL_INT, rewarded_ad_id: REAL_REW }));
    expect(c.testMode).toBe(false);
    expect(c.interstitialAdId).toBe(REAL_INT);
    expect(c.rewardedAdId).toBe(REAL_REW);
  });

  it('في الإنتاج معرّف غير صالح = إيقاف هذا النوع (null) وليس معرّف اختبار', () => {
    const c = parseAdConfig(rows({ enable_ads: 'true', ads_test_mode: 'false', interstitial_ad_id: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', rewarded_ad_id: '' }));
    expect(c.interstitialAdId).toBeNull();
    expect(c.rewardedAdId).toBeNull();
  });

  it('تحليل القيم المنطقية والفاصل الزمني بأمان', () => {
    expect(parseAdConfig(rows({ enable_ads: ' TRUE ' })).enableAds).toBe(true);
    expect(parseAdConfig(rows({ enable_ads: 'yes' })).enableAds).toBe(false); // غير معروف → الافتراضي
    expect(parseAdConfig(rows({ interstitial_cooldown_min: '5' })).cooldownMinutes).toBe(5);
    expect(parseAdConfig(rows({ interstitial_cooldown_min: '0' })).cooldownMinutes).toBe(1); // حد أدنى
    expect(parseAdConfig(rows({ interstitial_cooldown_min: '-9' })).cooldownMinutes).toBe(1);
    expect(parseAdConfig(rows({ interstitial_cooldown_min: '99999' })).cooldownMinutes).toBe(120);
    expect(parseAdConfig(rows({ interstitial_cooldown_min: 'abc' })).cooldownMinutes).toBe(5);
  });

  it('isValidAdUnitId يرفض معرّف التطبيق (~) والقيم الفارغة', () => {
    expect(isValidAdUnitId(REAL_INT)).toBe(true);
    expect(isValidAdUnitId('ca-app-pub-3940256099942544~3347511713')).toBe(false);
    expect(isValidAdUnitId('')).toBe(false);
    expect(isValidAdUnitId(null)).toBe(false);
  });

  it('يقبل الشكل المسطّح (camelCase) الخاص بالـ cache', () => {
    const c = parseAdConfig({ enableAds: true, testMode: false, interstitialAdId: REAL_INT, rewardedAdId: null, cooldownMinutes: 4 });
    expect(c).toMatchObject({ enableAds: true, testMode: false, interstitialAdId: REAL_INT, rewardedAdId: null, cooldownMinutes: 4 });
  });
});

describe('getAdConfig', () => {
  it('يجلب من Supabase ثم يستخدم الـ cache (طلب واحد فقط)', async () => {
    mocks.select.mockResolvedValue({ data: rows({ enable_ads: 'true' }), error: null });
    const a = await getAdConfig();
    const b = await getAdConfig();
    expect(a.enableAds).toBe(true);
    expect(b).toBe(a);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(AD_CONFIG_CACHE_KEY)).config.enableAds).toBe(true);
  });

  it('طلبات متزامنة = طلب شبكة واحد', async () => {
    mocks.select.mockResolvedValue({ data: rows({ enable_ads: 'true' }), error: null });
    await Promise.all([getAdConfig(), getAdConfig(), getAdConfig()]);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it('فشل الشبكة بدون cache → القيم الآمنة (إعلانات مقفولة) ولا يرمي', async () => {
    mocks.select.mockRejectedValue(new Error('offline'));
    const c = await getAdConfig();
    expect(c.enableAds).toBe(false);
    expect(c.testMode).toBe(true);
  });

  it('خطأ من Supabase → القيم الآمنة', async () => {
    mocks.select.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect((await getAdConfig()).enableAds).toBe(false);
  });

  it('فشل الشبكة مع نسخة قديمة محفوظة → يستخدم القديمة', async () => {
    localStorage.setItem(
      AD_CONFIG_CACHE_KEY,
      JSON.stringify({ at: Date.now() - AD_CONFIG_TTL_MS - 1000, config: { enableAds: true, testMode: true, cooldownMinutes: 7 } }),
    );
    mocks.select.mockRejectedValue(new Error('offline'));
    const c = await getAdConfig();
    expect(c.enableAds).toBe(true);
    expect(c.cooldownMinutes).toBe(7);
  });

  it('بعد فشل لا يعيد الطلب فوراً (يهدأ دقيقتين)', async () => {
    mocks.select.mockRejectedValue(new Error('offline'));
    await getAdConfig();
    await getAdConfig();
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it('force=true يتجاهل الـ cache (يلتقط تغيير Kill Switch)', async () => {
    mocks.select.mockResolvedValueOnce({ data: rows({ enable_ads: 'true' }), error: null });
    expect((await getAdConfig()).enableAds).toBe(true);
    mocks.select.mockResolvedValueOnce({ data: rows({ enable_ads: 'false' }), error: null });
    expect((await getAdConfig({ force: true })).enableAds).toBe(false);
  });

  it('cache تالف في localStorage لا يكسر شيئاً', async () => {
    localStorage.setItem(AD_CONFIG_CACHE_KEY, '{not json');
    mocks.select.mockResolvedValue({ data: rows({ enable_ads: 'true' }), error: null });
    expect((await getAdConfig()).enableAds).toBe(true);
  });

  it('SAFE_DEFAULTS ثابتة (لا تتعدل بالخطأ)', () => {
    expect(Object.isFrozen(SAFE_DEFAULTS)).toBe(true);
  });
});
