/*
 * =====================================================
 * ReportModal.jsx - نافذة الإبلاغ عن لاعب / رسالة
 * =====================================================
 * مطلوبة لسياسة Google Play لمحتوى المستخدمين (UGC): لازم يكون فيه
 * طريقة داخل التطبيق للإبلاغ. بتتفتح من:
 *  - جرس الإشعارات (إبلاغ عن رسالة) ← notificationId
 *  - بروفايل اللاعب في الليدربورد (إبلاغ عن اللاعب)
 * الكتابة في قاعدة البيانات عبر report_user() فقط (SECURITY DEFINER).
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

const REASONS = [
  { id: 'harassment',    label: 'إساءة أو تنمّر أو تهديد' },
  { id: 'inappropriate', label: 'محتوى غير لائق' },
  { id: 'spam',          label: 'رسائل مزعجة (سبام)' },
  { id: 'personal_info', label: 'طلب أو مشاركة معلومات شخصية' },
  { id: 'other',         label: 'سبب آخر' },
];

function ReportModal({ reportedUserId, reportedName, notificationId = null, onClose }) {
  const { reportUser } = useApp();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!reason || state === 'sending') return;
    setState('sending');
    const { error } = await reportUser({ reportedUserId, reason, details: details.trim(), notificationId });
    if (error) {
      // رسالة الحد اليومي مكتوبة بالعربي من السيرفر؛ أي خطأ تاني نعرض له رسالة عامة
      setErrorText(error.message?.includes('الحد اليومي') ? error.message : 'حصلت مشكلة، حاول تاني');
      setState('error');
    } else {
      setState('sent');
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      role="dialog" aria-modal="true" aria-label="إبلاغ"
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

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
        <button
          onClick={onClose}
          className="absolute left-4 top-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(200,146,42,0.15)' }}
          aria-label="إغلاق"
        >
          <i className="fi fi-rr-cross" aria-hidden="true" style={{ fontSize: '13px', color: '#8B5A2B' }} />
        </button>

        {state === 'sent' ? (
          <div className="text-center py-6">
            <i className="fi fi-sr-check-circle" aria-hidden="true" style={{ fontSize: '36px', color: '#2D6A3F' }} />
            <p className="font-black text-base mt-3" style={{ color: '#2D6A3F' }}>وصلنا بلاغك</p>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B4A1F' }}>
              شكراً إنك ساعدتنا نحافظ على ميسوري مكان آمن. هنراجع البلاغ.
            </p>
            <button onClick={onClose} className="mt-4 text-sm font-bold" style={{ color: '#6B4A1F' }}>إغلاق</button>
          </div>
        ) : (
          <>
            <h2 className="font-black text-base mb-1 text-center" style={{ color: '#3D2B1F' }}>
              {notificationId ? 'إبلاغ عن هذه الرسالة' : `إبلاغ عن ${reportedName || 'اللاعب'}`}
            </h2>
            <p className="text-xs text-center mb-4" style={{ color: '#6B4A1F' }}>اختار السبب:</p>

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="سبب البلاغ">
              {REASONS.map((r) => {
                const selected = reason === r.id;
                return (
                  <button
                    key={r.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(r.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right press-effect no-tap-highlight"
                    style={{
                      backgroundColor: selected ? 'rgba(200,146,42,0.18)' : 'white',
                      border: `1.5px solid ${selected ? '#805D1B' : 'rgba(200,146,42,0.25)'}`,
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ border: '2px solid #805D1B', backgroundColor: selected ? '#805D1B' : 'transparent' }}
                    />
                    <span className="text-sm font-bold" style={{ color: '#3D2B1F' }}>{r.label}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="تفاصيل إضافية (اختياري)"
              maxLength={300}
              rows={3}
              className="w-full mt-3 p-3 rounded-xl text-sm outline-none resize-none"
              style={{ backgroundColor: 'white', border: '1px solid rgba(200,146,42,0.3)', color: '#3D2B1F' }}
            />

            {state === 'error' && (
              <p role="alert" className="text-xs font-bold text-center mt-2" style={{ color: '#B91C1C' }}>{errorText}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || state === 'sending'}
                className="flex-1 py-3 rounded-xl font-bold text-white"
                style={{ backgroundColor: !reason || state === 'sending' ? '#A9793F' : '#B91C1C', opacity: !reason ? 0.7 : 1 }}
              >
                {state === 'sending' ? 'جاري الإرسال...' : 'إرسال البلاغ'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default ReportModal;
