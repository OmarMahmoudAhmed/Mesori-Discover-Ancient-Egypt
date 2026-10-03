/*
 * =====================================================
 * LevelsGrid.jsx - شبكة المستويات الخمسة (تصميم جديد)
 * =====================================================
 * ⬅️ الكروت بقت مستطيلة (أطول من عرضها، نسبة 3:4) بدل مربّعة
 *   صغيرة، عشان تتماشى مع التصميم المرجعي الجديد (رأس ملوّن +
 *   جسم أبيض يعرض صورة المستوى وإحصائياته بوضوح). العرض لسه
 *   بيتحسب بـ clamp() حسب عرض الشاشة، والارتفاع بيتبع نسبة
 *   الأبعاد تلقائياً (aspect-ratio) بدل حساب يدوي.
 * =====================================================
 */

import React from 'react';
import LevelCard  from './LevelCard';
import { useApp } from '../../context/AppContext';

const CARD_WIDTH = 'clamp(92px, 27vw, 122px)';

function LevelsGrid() {

  const { levelsData } = useApp();

  const firstRow  = levelsData.slice(0, 3);
  const secondRow = levelsData.slice(3);

  return (
    <section className="px-4 pt-2 pb-2 flex-shrink-0 flex flex-col items-center gap-2">

      {/* ===== الصف الأول: المستويات 1, 2, 3 ===== */}
      <div className="flex justify-center gap-3">
        {firstRow.map((level) => (
          <div key={level.id} style={{ width: CARD_WIDTH, aspectRatio: '4 / 5' }}>
            <LevelCard level={level} />
          </div>
        ))}
      </div>

      {/* ===== الصف الثاني: المستويات 4, 5 — نفس المقاس بالظبط ===== */}
      <div className="flex justify-center gap-3">
        {secondRow.map((level) => (
          <div key={level.id} style={{ width: CARD_WIDTH, aspectRatio: '4 / 5' }}>
            <LevelCard level={level} />
          </div>
        ))}
      </div>

    </section>
  );
}

export default LevelsGrid;
