/*
 * =====================================================
 * RankChangeToast.jsx - إشعار لحظي (toast) لتغيّر الترتيب
 * =====================================================
 * يظهر فقط لما تغيّر فعلي يحصل وانت واقف في صفحة الليدربورد
 * فعلياً (مش لما تفتح الصفحة لأول مرة — ده بتوضحه RankChangeBadge
 * الصغيرة). أخضر لو تخطيت حد، أحمر لو حد تخطاك. يختفي تلقائياً
 * بعد ثواني، وتقدر تقفله بلمسة عليه.
 *
 * AnimatePresence + key فريد لكل حدث عشان لو حصل تغيّر جديد قبل
 * ما القديم يختفي، الأنيميشن يعيد نفسه من الأول بدل ما يفضل
 * واقف على حاله.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function RankChangeToast({ toast, onDismiss }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          onClick={onDismiss}
          className="fixed left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            transform: 'translateX(-50%)',
            backgroundColor: toast.direction === 'up' ? '#2D6A3F' : '#B91C1C',
            maxWidth: '88%',
            cursor: 'pointer',
          }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            style={{ flexShrink: 0, transform: toast.direction === 'up' ? 'none' : 'rotate(180deg)' }}
          >
            <path d="M12 5L19 15H5Z" fill="white" />
          </svg>
          <span
            className="font-bold text-white text-sm text-center"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default RankChangeToast;
