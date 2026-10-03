/*
 * =====================================================
 * ageGate.js - بوابة السن (Google Play: تطبيق مش موجّه للأطفال)
 * =====================================================
 * ميسوري مش تطبيق أطفال: الحد الأدنى للسن 13 سنة. البوابة بتظهر قبل
 * شاشة الدخول/التسجيل (فتغطي التسجيل بالإيميل وبالسوشيال كمان)، وبتسأل
 * سؤال محايد (بدون ما نذكر الحد قبل الإجابة، عشان ما نشجّعش حد يكذب).
 *
 * ما بنخزّنه محلياً: علامتين boolean بس (عدّى البوابة / الجهاز محظور) —
 * مش بنخزّن السن نفسه. لو الإجابة أقل من الحد، الجهاز بيتعلّم "محظور"
 * عشان الرجوع وتغيير الإجابة ما يعدّيش.
 * الحماية الفعلية على السيرفر: trigger enforce_min_age (migration 015).
 * =====================================================
 */

export const MIN_AGE = 13;
export const MAX_AGE = 100;

const PASS_KEY = 'mesori_age_gate_passed';
const BLOCK_KEY = 'mesori_age_gate_blocked';

function read(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function write(key) {
  try { localStorage.setItem(key, '1'); } catch { /* التخزين غير متاح: بنكمل بدونه */ }
}

export const isAgeBlocked = () => read(BLOCK_KEY);
export const hasPassedAgeGate = () => read(PASS_KEY);
export const markAgeGatePassed = () => write(PASS_KEY);
export const markDeviceAgeBlocked = () => write(BLOCK_KEY);

/* 'ok' | 'under' | 'invalid' */
export function evaluateAge(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_AGE) return 'invalid';
  return n >= MIN_AGE ? 'ok' : 'under';
}
