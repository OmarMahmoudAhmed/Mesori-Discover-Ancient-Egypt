/*
 * =====================================================
 * messageFilter.js - منع مشاركة بيانات التواصل في الرسائل
 * =====================================================
 * يمنع إرسال رقم هاتف / بريد إلكتروني / رابط / حساب تواصل اجتماعي داخل
 * رسائل اللاعبين (حماية الخصوصية ومتطلبات Google Play لمحتوى المستخدمين).
 *
 * ⚠️ هذا الفلتر للتجربة (UX) فقط — العميل يقدر يتجاوزه. الحماية الفعلية
 * في السيرفر: public.detect_contact_info() داخل send_message()
 * (supabase/migrations/014_reports_and_message_filter.sql).
 * المنطق هنا والمنطق هناك لازم يفضلوا متطابقين — أي تعديل في واحد يتكرر في
 * التاني، والاختبارات (messageFilter.test.js) بتغطي نفس حالات SQL.
 * ملاحظة: مفيش lookbehind هنا عمداً (Safari/WebView القديم بيكسر البندل كله).
 *
 * خطوات التطبيع (متطابقة مع SQL):
 *   NFKC ← شيل الأحرف غير المرئية والتشكيل والتطويل ← أرقام عربية/فارسية → 0-9
 *   ← lowercase ← توحيد الألف/الياء/التاء المربوطة ← فك التمويه
 *   ("gmail dot com"، "name (at) x"، "x @ y . com").
 *
 * اللي بيمسكه:
 *  - أرقام بأي شكل: عربية/إنجليزية، فواصل (حتى 3 رموز غير حرفية بين رقمين،
 *    يعني مسافات/شرطات/نقط/رموز)، أرقام مكتوبة بالحروف ("صفر واحد صفر…")،
 *    ومجموع 11 رقم أو أكتر في الرسالة حتى لو متباعدين بحروف.
 *  - إيميلات (بما فيها at/dot ومسافات حوالين @)، http(s):// و www. ودومينات
 *    بامتدادات شائعة، ومعرّفات @name وأسماء تطبيقات التواصل (واتساب/تليجرام/…).
 * ما بيمسكه (حدود معروفة، والحماية التكميلية في السيرفر + نظام البلاغات):
 *  - دومين بامتداد مش في القائمة، أو تمويه بحروف بين الأرقام وإجمالي أقل من 11.
 *  - تقسيم الرقم على رسائل منفصلة: السيرفر بس هو اللي بيشوف سجل الرسائل.
 * =====================================================
 */

const INVISIBLE =
  /[\u00AD\u061C\u0640\u064B-\u065F\u0670\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

const TLDS = [
  'com', 'net', 'org', 'info', 'io', 'me', 'co', 'eg', 'app', 'link', 'ly', 'gl',
  'tv', 'xyz', 'online', 'site', 'store', 'ai', 'dev', 'cc', 'biz', 'click', 'top',
  'shop', 'live', 'club', 'gg', 'pro', 'vip', 'art', 'tk', 'ru', 'de', 'uk', 'fr',
  'sa', 'ae', 'kw', 'qa', 'tech', 'space', 'website', 'page', 'bio', 'fun', 'cloud',
  'one', 'us', 'ws', 'sh', 'ca',
].join('|');

const EMAIL_RE  = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
const SCHEME_RE = /(https?:\/\/|www\.)[^\s]+/;
const DOMAIN_RE = new RegExp(
  `(^|[^a-z0-9-])[a-z0-9][a-z0-9-]*(\\.[a-z0-9-]+)*\\.(${TLDS})([^a-z0-9]|$)`
);
const HANDLE_RE = /(^|[^a-z0-9._%+-])@[a-z0-9_.]{3,}/;
const SOCIAL_RE = new RegExp(
  '(^|[^a-z])(whats ?app|watsapp|telegram|instagram|insta|snapchat|facebook|messenger|discord|tik ?tok|skype|viber|wechat)([^a-z]|$)' +
  '|واتس|وتساب|تيليجرام|تليجرام|تلجرام|تلغرام|تيليغرام|انستجرام|انستغرام|انستا|سناب شات|سنابشات|فيسبوك|فيس بوك|ماسنجر|ميسنجر|ديسكورد|تيك توك|تيكتوك|سكايب|فايبر' +
  '|سناب([^ء-ي]|$)'
);

/* حرف = لاتيني أو عربي. الفاصل بين رقمين = أقصى 3 رموز مش حروف */
const PHONE_SEQ_RE = /[0-9](?:[^a-z0-9\u0621-\u064A\u0671-\u06D3]{0,3}[0-9]){7,}/;
const PHONE_TOTAL_DIGITS = 11;

/* فك تمويه الفواصل: [نمط، استبدال] — بيتكرر لحد ما يثبت */
const OBFUSCATION = [
  [/([a-z0-9])\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\}|\(\.\)|\[\.\]|\s(?:dot|نقطه)\s)\s*([a-z0-9])/g, '$1.$2'],
  [/([a-z0-9])\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\{\s*at\s*\}|\sat\s)\s*([a-z0-9])/g, '$1@$2'],
  [/\s*@\s*/g, '@'],
  [/([a-z0-9])\s+\.\s+([a-z0-9])/g, '$1.$2'],
];

/* أرقام مكتوبة بالحروف → رقم واحد من غير أي padding (عشان فواصل زي "صفر، واحد" ما تتخطاش حد الـ3 رموز) */
const NUMBER_WORDS = [
  [/(^|[^ء-ي])صفر(?=[^ء-ي]|$)/g, '0'],
  [/(^|[^ء-ي])واحده?(?=[^ء-ي]|$)/g, '1'],
  [/(^|[^ء-ي])(?:اتنين|اثنين|اثنان|اثنتين|تنين)(?=[^ء-ي]|$)/g, '2'],
  [/(^|[^ء-ي])(?:تلات|ثلاث)ه?(?=[^ء-ي]|$)/g, '3'],
  [/(^|[^ء-ي])اربعه?(?=[^ء-ي]|$)/g, '4'],
  [/(^|[^ء-ي])خمسه?(?=[^ء-ي]|$)/g, '5'],
  [/(^|[^ء-ي])سته?(?=[^ء-ي]|$)/g, '6'],
  [/(^|[^ء-ي])سبعه?(?=[^ء-ي]|$)/g, '7'],
  [/(^|[^ء-ي])(?:تمان|ثمان)(?:يه)?(?=[^ء-ي]|$)/g, '8'],
  [/(^|[^ء-ي])تسعه?(?=[^ء-ي]|$)/g, '9'],
  [/(^|[^a-z])zero(?=[^a-z]|$)/g, '0'],
  [/(^|[^a-z])one(?=[^a-z]|$)/g, '1'],
  [/(^|[^a-z])two(?=[^a-z]|$)/g, '2'],
  [/(^|[^a-z])three(?=[^a-z]|$)/g, '3'],
  [/(^|[^a-z])four(?=[^a-z]|$)/g, '4'],
  [/(^|[^a-z])five(?=[^a-z]|$)/g, '5'],
  [/(^|[^a-z])six(?=[^a-z]|$)/g, '6'],
  [/(^|[^a-z])seven(?=[^a-z]|$)/g, '7'],
  [/(^|[^a-z])eight(?=[^a-z]|$)/g, '8'],
  [/(^|[^a-z])nine(?=[^a-z]|$)/g, '9'],
];

/* التطبيع الأساسي (بدون فك التمويه): NFKC + شيل غير المرئي + أرقام + lowercase + توحيد عربي */
function baseNormalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

/* بيانات النص بعد التطبيع + فك التمويه (للإيميل/الرابط/السوشيال) */
export function normalizeForScan(text) {
  let t = baseNormalize(text);
  for (let i = 0; i < 3; i++) {
    const before = t;
    for (const [re, rep] of OBFUSCATION) t = t.replace(re, rep);
    if (t === before) break;
  }
  return t;
}

/* نفس التطبيع لكن الأرقام المكتوبة بالحروف اتحوّلت لأرقام (لفحص الهاتف + العدّ) */
export function digitStream(text) {
  let t = baseNormalize(text);
  for (const [re, digit] of NUMBER_WORDS) t = t.replace(re, (_m, pre) => pre + digit);
  return t;
}

export function countDigits(text) {
  return (digitStream(text).match(/[0-9]/g) || []).length;
}

/* 'email' | 'link' | 'social' | 'phone' | null — نفس ترتيب detect_contact_info() في SQL */
export function getSensitiveType(text) {
  const t = normalizeForScan(text);
  if (EMAIL_RE.test(t)) return 'email';
  if (SCHEME_RE.test(t) || DOMAIN_RE.test(t)) return 'link';
  if (HANDLE_RE.test(t) || SOCIAL_RE.test(t)) return 'social';
  const d = digitStream(text);
  if (PHONE_SEQ_RE.test(d)) return 'phone';
  if ((d.match(/[0-9]/g) || []).length >= PHONE_TOTAL_DIGITS) return 'phone';
  return null;
}

export function containsSensitiveData(text) {
  return getSensitiveType(text) !== null;
}

export const SENSITIVE_LABELS_AR = {
  email: 'بريد إلكتروني',
  link: 'رابط',
  phone: 'رقم هاتف',
  social: 'حساب تواصل اجتماعي',
};

export function sensitiveWarningAr(type) {
  const label = SENSITIVE_LABELS_AR[type];
  return label
    ? `لا يمكن إرسال الرسالة لأنها تحتوي على ${label}. شيله عشان نحمي خصوصيتك.`
    : null;
}

/* يحوّل خطأ السيرفر (CONTACT_INFO_PHONE...) لنوع، أو null لو خطأ تاني */
export function sensitiveTypeFromServerError(error) {
  const m = /CONTACT_INFO_(EMAIL|LINK|PHONE|SOCIAL)/.exec(error?.message ?? '');
  return m ? m[1].toLowerCase() : null;
}
