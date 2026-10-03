/*
 * =====================================================
 * DeleteAccountModal.jsx - تأكيد حذف الحساب نهائياً
 * =====================================================
 * مطلوب من Google Play (مسار حذف حساب داخل التطبيق). المستخدم لازم
 * يكتب كلمة "حذف" بنفسه عشان يتفعّل الزر. التنفيذ الفعلي في
 * AppContext.deleteAccount() ← Edge Function delete-user-account.
 * بعد النجاح الجلسة بتتمسح فيرجع التطبيق لصفحة الدخول تلقائياً.
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

const CONFIRM_WORD = 'حذف';

function DeleteAccountModal({ onClose }) {
  const { deleteAccount } = useApp();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const canDelete = typed.trim() === CONFIRM_WORD && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setFailed(false);
    const { error } = await deleteAccount();
    if (error) {
      console.error('❌ فشل حذف الحساب:', error);
      setFailed(true);
      setBusy(false);
    }
    // عند النجاح: الجلسة اتمسحت والتطبيق بيعرض صفحة الدخول (المودال بيتشال معاها)
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      role="dialog" aria-modal="true" aria-label="حذف الحساب"
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={busy ? undefined : onClose} />

      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md rounded-t-3xl p-6 max-h-[90dvh] overflow-y-auto"
        style={{
          backgroundColor: '#FDF3E3',
          fontFamily: "'Cairo', sans-serif",
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="text-center mb-4">
          <i className="fi fi-sr-triangle-warning" aria-hidden="true" style={{ fontSize: '30px', color: '#B91C1C' }} />
          <h2 className="font-black text-base mt-2" style={{ color: '#3D2B1F' }}>حذف حسابي نهائياً</h2>
        </div>

        <p className="text-sm leading-relaxed mb-2" style={{ color: '#3D2B1F' }}>
          سيتم حذف حسابك وكل بياناتك المرتبطة به نهائياً، ولا يمكن استعادتها:
        </p>
        <ul className="text-sm leading-relaxed mb-4 pr-5 list-disc" style={{ color: '#3D2B1F' }}>
          <li>الملف الشخصي والنقاط والشارات</li>
          <li>تقدّمك في المستويات والاختبارات</li>
          <li>مباريات 1 ضد 1 والرسائل والإشعارات</li>
        </ul>

        <label htmlFor="delete-confirm" className="block text-xs font-bold mb-1.5" style={{ color: '#6B4A1F' }}>
          للتأكيد اكتب كلمة «{CONFIRM_WORD}»
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          className="w-full p-3 rounded-xl text-base outline-none"
          style={{ backgroundColor: 'white', border: '1px solid rgba(185,28,28,0.4)', color: '#3D2B1F' }}
        />

        {failed && (
          <p role="alert" className="text-xs font-bold text-center mt-3" style={{ color: '#B91C1C' }}>
            ما قدرناش نحذف الحساب. اتأكد من الإنترنت وحاول تاني، ولو المشكلة استمرت راسلنا من «عن المطوّر».
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-bold"
            style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
          >
            إلغاء
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex-1 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: canDelete ? '#B91C1C' : '#C98B8B' }}
          >
            {busy ? 'جاري الحذف...' : 'حذف نهائياً'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default DeleteAccountModal;
