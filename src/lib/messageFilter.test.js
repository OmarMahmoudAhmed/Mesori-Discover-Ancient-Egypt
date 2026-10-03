import { describe, it, expect } from 'vitest';
import {
  getSensitiveType,
  containsSensitiveData,
  sensitiveWarningAr,
  sensitiveTypeFromServerError,
} from './messageFilter';

// نفس حالات اختبار SQL (detect_contact_info) — لو اختلفت النتيجة يبقى الفلترين خرجوا عن التطابق
const CASES = [
  // ── كلام عادي لازم يعدّي ──
  ['تعالى نلعب مباراة', null],
  ['مين بنى الهرم الأكبر؟ عام 2560 ق.م', null],
  ['عندي 1500 نقطة ومستوى 5', null],
  ['الحمد لله. انا كويس', null],
  ['انا اسمي احمد.شكرا', null],
  ['end.Yes it is', null],
  ['I won. Me too', null],
  ['العب معايا ست الكل', null],
  ['خلصت المرحلة 3 وجبت 100 نقطة', null],
  ['one more round? instant rematch', null],
  ['توت عنخ امون حكم من 1332 لـ 1323 ق.م', null],
  ['ممكن نلعب بكرة الساعة 5؟', null],
  // ── أرقام هاتف ──
  ['كلمني على 01012345678', 'phone'],
  ['رقمي ٠١٠١٢٣٤٥٦٧٨', 'phone'],
  ['٠١٠١٢٣٤٥٦٧٨٩', 'phone'],
  ['۰۱۰۱۲۳۴۵۶۷۸', 'phone'],
  ['０１０１２３４５６７８', 'phone'],
  ['0101 234 5678', 'phone'],
  ['+20 10 1234 5678', 'phone'],
  ['01-01-23-45-67-89', 'phone'],
  ['0 1 0 1 2 3 4 5 6 7 8', 'phone'],
  ['0 . 1 . 0 . 1 . 2 . 3 . 4 . 5', 'phone'],
  ['0_1_0_1_2_3_4_5_6_7_8', 'phone'],
  ['0/1/0/1/2/3/4/5/6', 'phone'],
  ['0101\u200B2345\u200B678', 'phone'],
  ['0\u064B1\u06400123456789', 'phone'],
  ['صفر واحد صفر واحد اتنين تلاتة اربعة خمسة', 'phone'],
  ['صفر، واحد، صفر، واحد، اتنين، تلاتة، اربعة، خمسة', 'phone'],
  ['zero one zero one two three four five', 'phone'],
  ['0a1b0c1d2e3f4g5h6i7j8k', 'phone'],
  // ── إيميلات ──
  ['mail me test.user@gmail.com', 'email'],
  ['ابعتلي على omar@x.io', 'email'],
  ['omar @ gmail . com', 'email'],
  ['omar (at) gmail (dot) com', 'email'],
  ['omar at gmail dot com', 'email'],
  ['omar[at]gmail[dot]com', 'email'],
  ['omar＠gmail.com', 'email'],
  // ── روابط ──
  ['https://wa.me/20101', 'link'],
  ['شوف www.example.org', 'link'],
  ['instagram.com/foo', 'link'],
  ['t.me/omar', 'link'],
  ['HTTPS://EVIL.COM', 'link'],
  ['gmail dot com', 'link'],
  ['example . xyz', 'link'],
  ['site.pro', 'link'],
  // ── سوشيال ──
  ['ضيفني على واتساب', 'social'],
  ['الواتس معاك؟', 'social'],
  ['add me on telegram', 'social'],
  ['snapchat: omar', 'social'],
  ['سناب', 'social'],
  ['تيك توك', 'social'],
  ['@omar_123', 'social'],
  ['كلمني @omar.eg', 'link'],
];

describe('messageFilter', () => {
  it.each(CASES)('%s → %s', (text, expected) => {
    expect(getSensitiveType(text)).toBe(expected);
  });

  it('containsSensitiveData مرتبطة بـ getSensitiveType', () => {
    expect(containsSensitiveData('اهلا')).toBe(false);
    expect(containsSensitiveData('01012345678')).toBe(true);
  });

  it('يتعامل مع null/undefined بدون ما يرمي خطأ', () => {
    expect(getSensitiveType(null)).toBeNull();
    expect(getSensitiveType(undefined)).toBeNull();
  });

  it('رسالة التحذير بالعربي', () => {
    expect(sensitiveWarningAr('phone')).toContain('رقم هاتف');
    expect(sensitiveWarningAr(null)).toBeNull();
  });

  it('يقرأ خطأ السيرفر', () => {
    expect(sensitiveTypeFromServerError({ message: 'CONTACT_INFO_LINK' })).toBe('link');
    expect(sensitiveTypeFromServerError({ message: 'something else' })).toBeNull();
    expect(sensitiveTypeFromServerError(null)).toBeNull();
  });
});
