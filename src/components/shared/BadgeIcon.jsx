/*
 * =====================================================
 * BadgeIcon.jsx - عرض أيقونة أي شارة
 * =====================================================
 * عمود icon في جدول badges (Supabase) يحمل قيمة على شكلين:
 * - 'fi-sr-xxx'        → كلاس Flaticon Uicons عادي
 * - 'badge:Mummy.svg'  → اسم ملف مخصص داخل public/assets/icons/badges/
 * =====================================================
 */

import React from 'react';

export function BadgeIcon({ icon, size = 28, color = '#C8922A', locked = false }) {
  if (icon?.startsWith('badge:')) {
    const filename = icon.slice('badge:'.length);
    return (
      <img
        src={`/assets/icons/badges/${filename}`}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, opacity: locked ? 0.35 : 1, filter: locked ? 'grayscale(1)' : 'none' }}
      />
    );
  }

  return (
    <i
      className={`fi ${icon || 'fi-sr-medal'}`}
      aria-hidden="true"
      style={{ fontSize: size, color: locked ? '#686462' : color }}
    />
  );
}
