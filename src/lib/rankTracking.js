/*
 * =====================================================
 * rankTracking.js - تتبّع تغيّر الترتيب والنقاط بين الزيارات
 * =====================================================
 * يقارن ترتيب/نقاط المستخدم الحاليين بآخر قيم محفوظة محلياً
 * (localStorage) من آخر مرة فتح فيها صفحة الليدربورد، عشان نظهر
 * تأثير "طلعت / نزلت في الترتيب" لحظة الدخول — بدون أي تغيير في
 * السيرفر أو جدول الـ leaderboard نفسه.
 *
 * ⚠️ حدود هذا النظام (مهم تعرفها): بيكتشف الفرق بين زيارتين
 * لصفحة الليدربورد فقط — مش تتبّع لحظي وانت التطبيق مقفول. راجع
 * notifications.js للتفاصيل الكاملة عن الفرق بين ده وبين إشعار
 * push حقيقي.
 *
 * التخزين مفتاحه user_id (مش تخزين عام) عشان لو أكتر من حساب
 * استخدم نفس الجهاز، كل حساب له "آخر ترتيب معروف" منفصل.
 */

const STORAGE_PREFIX = 'mesori:lastSeenRank:';

/** يرجع { rank, points, savedAt } من آخر زيارة، أو null لو أول مرة */
export function getLastSeenRank(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // localStorage غير متاح (وضع تصفّح خاص مثلاً) — تجاهل بأمان
  }
}

/** يحفظ الترتيب/النقاط الحاليين كأساس للمقارنة في الزيارة الجاية */
export function saveLastSeenRank(userId, { rank, points }) {
  if (!userId || rank == null) return;
  try {
    localStorage.setItem(
      STORAGE_PREFIX + userId,
      JSON.stringify({ rank, points, savedAt: Date.now() })
    );
  } catch {
    /* تجاهل بأمان لو التخزين غير متاح */
  }
}

/*
 * يحسب الفرق بين آخر حالة محفوظة (previous) والحالة الحالية
 * (current: { rank, points }).
 * - rankDelta موجب  = تحسّن (رقم الترتيب قلّ، مثلاً من 5 لـ 3 → +2)
 * - rankDelta سالب  = تراجع (حد تخطاك فعلياً، مثلاً من 3 لـ 5 → -2)
 * يرجع null لو مفيش زيارة سابقة (أول مرة) أو مفيش تغيير خالص.
 */
export function computeRankChange(previous, current) {
  if (!previous || current?.rank == null) return null;

  const rankDelta = previous.rank - current.rank;
  const pointsDelta = (current.points ?? 0) - (previous.points ?? 0);

  if (rankDelta === 0 && pointsDelta === 0) return null;

  return {
    rankDelta,
    pointsDelta,
    overtaken: rankDelta < 0,
  };
}
