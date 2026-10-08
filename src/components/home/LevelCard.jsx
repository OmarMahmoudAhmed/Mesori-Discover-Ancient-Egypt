/*
 * =====================================================
 * LevelCard.jsx - بطاقة المستوى الواحد (تصميم جديد فاتح)
 * =====================================================
 * ⬅️ إعادة تصميم كاملة: بدل الكرت الداكن بتأثيرات الطيف/اللمعان،
 *   بقى كرت فاتح (خلفية بيضاء) مع رأس ملوّن باسم المستوى، صورة
 *   المستوى الحقيقية زي ما هي بدون أي تعديل عليها، اسم الصعوبة
 *   بلون المستوى المميز، وصف إحصائي (اختبارات / نقاط) في صفّين
 *   تحت الصورة. الحدّ الخارجي والنص المميز بياخدوا نفس لون
 *   المستوى (textColor) عشان الهوية اللونية لكل مستوى تفضل واضحة
 *   حتى مع الخلفية البيضاء. التفاعلات (press-effect / card-hover)
 *   بقت بتستخدم الكلاسات الجاهزة الموجودة أصلاً في index.css بدل
 *   أنيميشن مخصص تقيل — أخف وأوضح وأقرب لأسلوب التطبيقات الاحترافية.
 * =====================================================
 */

import React from 'react';
import { useApp } from '../../context/AppContext';

function LevelCard({ level }) {
  const { navigateTo } = useApp();

  const handlePress = () => {
    if (level.isUnlocked) {
      navigateTo('quiz-group', { levelId: level.id });
    } else {
      alert(`🔒 المستوى ${level.nameAr} مقفول حالياً!\nأكمل المستوى السابق لفتحه.`);
    }
  };

  return (
    <div
      onClick={handlePress}
      className="
        h-full flex flex-col rounded-2xl overflow-hidden bg-white
        shadow-card card-hover press-effect no-tap-highlight
        cursor-pointer select-none transition-shadow duration-200
      "
      style={{
        border: `2px solid ${level.textColor}`,
        opacity: level.isUnlocked ? 1 : 0.6,
        filter: level.isUnlocked ? 'none' : 'grayscale(0.5)',
      }}
    >
      {/* ===== رأس البطاقة: اسم المستوى بالإنجليزية على خلفية ملوّنة ===== */}
      <div
        className="relative flex items-center justify-center py-1 px-2 flex-shrink-0"
        style={{ backgroundColor: level.headerBg }}
      >
        <span
          className="font-bold text-white tracking-wide truncate"
          style={{ fontFamily: "'Cinzel', serif", fontSize: '11px' }}
        >
          {level.nameEn}
        </span>

        {!level.isUnlocked && (
          <img
            src="/assets/icons/badges/lock.png"
            alt="مقفول"
            width={14}
            height={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-90"
          />
        )}
      </div>

      {/* ===== الجسم الأبيض: اسم الصعوبة + صورة المستوى ===== */}
      <div className="flex-1 min-h-0 flex flex-col items-center px-1.5 pt-0.5 pb-0">
        <span
          className="font-black truncate max-w-full"
          style={{ fontFamily: "'Cairo', sans-serif", fontSize: '13px', color: level.textColor }}
        >
          {level.nameAr}
        </span>

        {/* منطقة الصورة — تتقلص/تكبر مع المساحة المتاحة، الصورة نفسها من غير أي تعديل */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <img
            src={level.iconSrc}
            alt={level.nameAr}
            className="max-w-[86%] max-h-full w-auto h-auto"
            style={{ objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* ===== ذيل الإحصائيات: عدد الاختبارات + النقاط الممكنة، سطر لكل واحد ===== */}
      <div className="flex flex-col items-center gap-0.5 pb-1 pt-0 flex-shrink-0">
        <div className="flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#8B5A3C" className="flex-shrink-0">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
          <span
            className="font-semibold truncate"
            style={{ fontFamily: "'Cairo', sans-serif", fontSize: '9px', color: '#5C4530' }}
          >
            {level.quizCount} اختبارات
          </span>
        </div>

        <div className="flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#8B5A3C" className="flex-shrink-0">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span
            className="font-semibold truncate"
            style={{ fontFamily: "'Cairo', sans-serif", fontSize: '9px', color: '#5C4530' }}
          >
            {level.maxPoints} نقطة ممكنة
          </span>
        </div>
      </div>
    </div>
  );
}

export default LevelCard;
