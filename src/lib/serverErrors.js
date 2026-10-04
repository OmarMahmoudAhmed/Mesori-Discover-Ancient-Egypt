/*
 * أكواد أخطاء الرسائل/الدعوات من السيرفر (migration 016) ← رسائل عربي للمستخدم.
 * MESSAGE_UNAVAILABLE (الطرف التاني حاظرك) محايدة عمداً: ما بنكشفش الحظر.
 */
const CODES = ['TERMS_NOT_ACCEPTED', 'MESSAGE_BLOCKED_BY_ME', 'MESSAGE_UNAVAILABLE', 'RATE_LIMITED'];

export function messageErrorCode(error) {
  const msg = String(error?.message ?? '');
  return CODES.find((c) => msg.includes(c)) ?? null;
}

export const MESSAGE_ERRORS_AR = {
  MESSAGE_BLOCKED_BY_ME: 'أنت حاظر هذا اللاعب. ارفع الحظر من الإعدادات لو عايز تتواصل معاه.',
  MESSAGE_UNAVAILABLE: 'مش قادرين نوصّل الرسالة لهذا اللاعب.',
  RATE_LIMITED: 'بعتّ رسائل كتير. استنى شوية وحاول تاني.',
};

export function messageErrorTextAr(error) {
  const code = messageErrorCode(error);
  return code ? MESSAGE_ERRORS_AR[code] ?? null : null;
}
