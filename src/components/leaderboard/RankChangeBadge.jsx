/*
 * =====================================================
 * RankChangeBadge.jsx - شارة صغيرة متحركة بجانب ترتيبك
 * =====================================================
 * تظهر فقط في صف المستخدم الحالي بصفحة الليدربورد، وتعرض التغيّر
 * منذ آخر زيارة: أخضر + سهم لأعلى (تحسّن)، أحمر + سهم لأسفل (حد
 * تخطاك). لا تعرض حاجة لو مفيش تغيير (rankDelta = 0/undefined).
 *
 * سهم SVG بسيط (مثلث) بدل خط أيقونات خارجي — عشان نضمن ظهوره
 * صح دايماً بدل الاعتماد على اسم كلاس أيقونة معيّن.
 */
import React from 'react';
import { motion } from 'framer-motion';

function RankChangeBadge({ rankDelta }) {
  if (!rankDelta) return null;
  const isUp = rankDelta > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: isUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full absolute -top-1.5 -right-1.5"
      style={{
        backgroundColor: isUp ? '#2D6A3F' : '#B91C1C',
        boxShadow: `0 2px 6px ${isUp ? 'rgba(45,106,63,0.5)' : 'rgba(185,28,28,0.5)'}`,
      }}
      aria-label={isUp ? `ترتيبك ارتفع ${rankDelta} مركز` : `ترتيبك نزل ${Math.abs(rankDelta)} مركز`}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" style={{ display: 'block', transform: isUp ? 'none' : 'rotate(180deg)' }}>
        <path d="M12 5L19 15H5Z" fill="white" />
      </svg>
      <span className="font-black text-white" style={{ fontSize: '9px', fontFamily: "'Cairo', sans-serif" }}>
        {Math.abs(rankDelta)}
      </span>
    </motion.div>
  );
}

export default RankChangeBadge;
