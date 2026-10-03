/*
 * =====================================================
 * avatars.js - سجل الأفاتارات المتاحة
 * =====================================================
 * مصدر واحد للحقيقة لكل أفاتار متاح للاختيار في التطبيق.
 * نوعان:
 * - type: 'image'  → صورة شخصية كاملة موجودة أصلاً (ولد/بنت)
 * - type: 'icon'   → أيقونة Flaticon داخل دائرة ملوّنة (جديد)
 *
 * أي مكان في التطبيق يعرض أفاتار المستخدم (ProfilePage,
 * LeaderboardPage, نافذة بروفايل لاعب آخر) يجب أن يستخدم
 * <AvatarDisplay avatarKey={...} /> من هذا الملف بدل تكرار
 * منطق العرض في كل مكان.
 * =====================================================
 */

import React from 'react';
import boyImage  from '../components/shared/Character1_Pic.png';
import girlImage from '../components/shared/Character2_Pic.png';
import Horus from '../components/shared/Horus_Pic.png';
import Isis from '../components/shared/Isis_Pic.png';
import Thutmose from '../components/shared/Thutmose_Pic.png';
import Hatshepsut from '../components/shared/Hatshepsut_Pic.png';

export const AVATARS = [
  { id: 'boy',     type: 'image', label: 'ولد',     src: boyImage },
  { id: 'girl',    type: 'image', label: 'بنت',     src: girlImage },
  { id: 'Horus',   type: 'image',  label: 'حورس',   src: Horus },
  { id: 'Isis',    type: 'image',  label: 'إيزيس',   src: Isis },
  { id: 'Thutmose', type: 'image',  label: 'تحتمس', src: Thutmose },
  { id: 'Hatshepsut', type: 'image',  label: 'حتشبسوت', src: Hatshepsut },
];

const AVATAR_BY_ID = Object.fromEntries(AVATARS.map(a => [a.id, a]));

export function getAvatar(avatarKey) {
  return AVATAR_BY_ID[avatarKey] || AVATAR_BY_ID.boy;
}

/*
 * AvatarDisplay - مكوّن موحّد لعرض أي أفاتار بأي حجم
 * @prop avatarKey {string} - أحد مفاتيح AVATARS أعلاه
 * @prop size {number} - القطر بالبكسل (افتراضياً 48)
 */
export function AvatarDisplay({ avatarKey, size = 48 }) {
  const avatar = getAvatar(avatarKey);

  if (avatar.type === 'image') {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: '#F4E2BC' }}
      >
        <img
          src={avatar.src}
          alt={avatar.label}
          className="w-full h-full"
          style={{ objectFit: 'cover', objectPosition: 'top center' }}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: `${avatar.color}1A` }}
    >
      <i
        className={`fi ${avatar.icon}`}
        aria-hidden="true"
        style={{ fontSize: size * 0.5, color: avatar.color }}
      />
    </div>
  );
}
