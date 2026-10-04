/*
 * =====================================================
 * LegalModal.jsx - «الخصوصية وشروط الاستخدام»
 * =====================================================
 * نافذة واحدة بتجمع: سياسة الخصوصية، شروط الاستخدام، وحذف الحساب
 * (حذف الحساب للمسجّلين فقط). الإبلاغ والحظر في ملف اللاعب وإشعارات الرسائل.
 * =====================================================
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../lib/legal';

function LegalModal({ onClose, onDeleteAccount }) {
  const { session } = useApp();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [
    { key: 'privacy', icon: 'fi-rr-shield-check', label: 'سياسة الخصوصية', hint: 'إيه البيانات اللي بنجمعها وإزاي بنحميها', onClick: () => window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer') },
    { key: 'terms', icon: 'fi-rr-document', label: 'شروط الاستخدام', hint: 'قواعد السلوك والإبلاغ والحظر', onClick: () => window.open(TERMS_URL, '_blank', 'noopener,noreferrer') },
    ...(session?.user?.id ? [{ key: 'delete', icon: 'fi-rr-trash', label: 'حذف حسابي', hint: 'حذف الحساب وبياناتك نهائياً', danger: true, onClick: onDeleteAccount }] : []),
  ];

  return createPortal(
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      role="dialog" aria-modal="true" aria-label="الخصوصية وشروط الاستخدام">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md rounded-t-3xl p-6 max-h-[85dvh] overflow-y-auto"
        style={{ backgroundColor: '#FDF3E3', fontFamily: "'Cairo', sans-serif", paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        dir="rtl"
      >
        <button onClick={onClose} className="absolute left-4 top-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(200,146,42,0.15)' }} aria-label="إغلاق">
          <i className="fi fi-rr-cross" aria-hidden="true" style={{ fontSize: '13px', color: '#8B5A2B' }} />
        </button>
        <h2 className="font-black text-base mb-4 text-center" style={{ color: '#3D2B1F' }}>الخصوصية وشروط الاستخدام</h2>

        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                onClick={r.onClick}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-right press-effect no-tap-highlight"
                style={{ backgroundColor: 'white', border: `1px solid ${r.danger ? 'rgba(185,28,28,0.3)' : 'rgba(200,146,42,0.25)'}` }}
              >
                <i className={`fi ${r.icon}`} aria-hidden="true" style={{ fontSize: '18px', color: r.danger ? '#B91C1C' : '#805D1B' }} />
                <span className="flex-1">
                  <span className="block font-bold text-sm" style={{ color: r.danger ? '#B91C1C' : '#3D2B1F' }}>{r.label}</span>
                  <span className="block text-xs" style={{ color: '#8B5A2B' }}>{r.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default LegalModal;
