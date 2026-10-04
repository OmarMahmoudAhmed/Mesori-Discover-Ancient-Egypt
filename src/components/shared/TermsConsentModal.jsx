/*
 * =====================================================
 * TermsConsentModal.jsx - الموافقة على شروط الاستخدام قبل أول رسالة
 * =====================================================
 * مطلوبة لسياسة Google Play لمحتوى المستخدمين (UGC): المستخدم لازم يوافق
 * على شروط تمنع المحتوى المسيء قبل ما يرسل. الموافقة بتتسجّل على السيرفر
 * (accept_terms ← profiles.terms_accepted_at) و send_message بترفض من غيرها.
 * =====================================================
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { TERMS_URL } from '../../lib/legal';

const RULES = [
  'ممنوع الإساءة أو التنمّر أو التهديد أو أي محتوى جارح أو غير لائق.',
  'ممنوع مشاركة أرقام الهاتف أو الإيميلات أو الروابط أو حسابات التواصل.',
  'ممنوع الرسائل المزعجة (سبام) أو انتحال شخصية حد تاني.',
  'تقدر تبلّغ عن أي رسالة أو لاعب، وتحظر أي لاعب في أي وقت.',
  'بنراجع البلاغات، وأي حساب بيخالف الشروط بيتحذّر أو بيتحذف.',
];

function TermsConsentModal({ onAccepted, onClose }) {
  const { acceptTerms } = useApp();
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | error

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAccept = async () => {
    if (!checked || state === 'sending') return;
    setState('sending');
    const { error } = await acceptTerms();
    if (error) { setState('error'); return; }
    onAccepted();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      role="dialog" aria-modal="true" aria-label="شروط الاستخدام"
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md rounded-t-3xl p-6 max-h-[90dvh] overflow-y-auto"
        style={{
          backgroundColor: '#FDF3E3',
          fontFamily: "'Cairo', sans-serif",
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
        }}
        dir="rtl"
      >
        <h2 className="font-black text-base mb-1 text-center" style={{ color: '#3D2B1F' }}>قبل ما تبعت رسالة</h2>
        <p className="text-xs text-center mb-4" style={{ color: '#6B4A1F' }}>
          عشان ميسوري يفضل مكان آمن للجميع، لازم توافق على شروط الاستخدام:
        </p>

        <ul className="flex flex-col gap-2 mb-4">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#3D2B1F' }}>
              <span aria-hidden="true" style={{ color: '#805D1B' }}>•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        <a
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs font-bold underline mb-4"
          style={{ color: '#805D1B' }}
        >
          اقرأ شروط الاستخدام كاملة
        </a>

        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-5 h-5 flex-shrink-0"
            style={{ accentColor: '#805D1B' }}
          />
          <span className="text-sm font-bold" style={{ color: '#3D2B1F' }}>قرأت شروط الاستخدام وأوافق عليها</span>
        </label>

        {state === 'error' && (
          <p role="alert" className="text-xs font-bold text-center mb-3" style={{ color: '#B91C1C' }}>
            حصلت مشكلة، حاول تاني
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>
            إلغاء
          </button>
          <button
            onClick={handleAccept}
            disabled={!checked || state === 'sending'}
            className="flex-1 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: !checked || state === 'sending' ? '#A9793F' : '#2D6A3F', opacity: !checked ? 0.7 : 1 }}
          >
            {state === 'sending' ? 'جاري الحفظ...' : 'أوافق'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default TermsConsentModal;
