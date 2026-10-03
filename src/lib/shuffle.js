/*
 * =====================================================
 * shuffle.js - أدوات تبعثر بسيطة للأسئلة العادية (المراحل)
 * =====================================================
 * للوضع العادي بس (مش مود 1 ضد 1 — ده بيتبعتر على السيرفر عشان
 * الاتنين يشوفوا نفس الترتيب، راجع migration
 * shuffle_match_answer_options). هنا العميل الوحيد هو اللاعب نفسه،
 * فمفيش داعي لأي تعقيد على السيرفر — بعثرة عادية في المتصفح كافية
 * وأسرع.
 * =====================================================
 */

/* Fisher-Yates — تبعثر عادل حقيقي (مش .sort(()=>Math.random()-0.5)
   اللي بيدّي توزيع منحاز) */
export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/*
 * يرجّع نسخة من السؤال باختيارات مبعثرة، مع تحديث correctIndex
 * تلقائياً ليطابق الموضع الجديد للإجابة الصح.
 */
export function shuffleQuestionOptions(question) {
  const order = shuffleArray(question.options.map((_, i) => i));
  const options = order.map((originalIndex) => question.options[originalIndex]);
  const correctIndex = order.indexOf(question.correctIndex);
  return { ...question, options, correctIndex };
}
