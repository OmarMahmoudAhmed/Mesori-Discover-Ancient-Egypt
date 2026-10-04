/*
 * =====================================================
 * NotificationBell.jsx - جرس الإشعارات + شارة العدد غير المقروء
 * =====================================================
 * تحل محل أيقونة الصوت السابقة في أعلى الصفحة الرئيسية. عند
 * الضغط تفتح قائمة بآخر الإشعارات (رسائل + شارات جديدة).
 * =====================================================
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { createPortal } from 'react-dom';
import ReportModal from '../shared/ReportModal';

function timeAgo(isoDate) {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function NotificationBell() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, navigateTo, blockUser } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // { userId, notificationId }
  const [blockTarget, setBlockTarget] = useState(null);   // { userId, name }
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState('');

  const confirmBlock = async () => {
    if (!blockTarget) return;
    setBlockBusy(true);
    setBlockError('');
    const { error } = await blockUser(blockTarget.userId);
    setBlockBusy(false);
    if (error) setBlockError('تعذّر الحظر، حاول تاني');
    else setBlockTarget(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-10 h-10 rounded-full flex items-center justify-center press-effect no-tap-highlight relative"
        style={{ backgroundColor: 'rgba(200,146,42,0.12)' }}
        aria-label="الإشعارات"
      >
        <i className="fi fi-rr-bell" aria-hidden="true" style={{ fontSize: '18px', color: '#805D1B' }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
            style={{ backgroundColor: '#DC2626', fontFamily: "'Cairo', sans-serif" }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 top-14 z-40 w-72 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto rounded-2xl origin-top-left"
                style={{ backgroundColor: 'white', boxShadow: '0 8px 24px rgba(61,43,31,0.2)', border: '1px solid rgba(200,146,42,0.15)' }}
              >
              <div
                className="flex items-center justify-between px-4 py-3 sticky top-0"
                style={{ backgroundColor: 'white', borderBottom: '1px solid rgba(200,146,42,0.12)' }}
              >
                <span className="font-black text-sm" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
                  الإشعارات
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-bold"
                    style={{ fontFamily: "'Cairo', sans-serif", color: '#805D1B' }}
                  >
                    علّم الكل كمقروء
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-center text-sm py-8 px-4" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
                  مفيش إشعارات لسه
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="w-full flex items-start"
                    style={{ borderBottom: '1px solid rgba(200,146,42,0.08)', backgroundColor: n.read_at ? 'transparent' : 'rgba(200,146,42,0.06)' }}
                  >
                    <button
                      onClick={() => {
                        markNotificationRead(n.id);
                        if ((n.type === 'match_invite' || n.type === 'match_result') && n.related_id) {
                          setIsOpen(false);
                          navigateTo('vs-match', { matchId: n.related_id });
                        }
                      }}
                      className="flex-1 min-w-0 flex items-start gap-2.5 px-4 py-3 text-right press-effect no-tap-highlight"
                    >
                      <i
                        className={`fi ${n.type === 'badge' ? 'fi-sr-medal' : n.type === 'match_invite' || n.type === 'match_result' ? 'fi-sr-sword' : 'fi-sr-envelope'}`}
                        aria-hidden="true"
                        style={{ fontSize: '14px', color: '#805D1B', marginTop: '2px' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs mt-0.5 truncate" style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}>
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] mt-1" style={{ fontFamily: "'Cairo', sans-serif", color: '#686462' }}>
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: '#C8922A' }} />
                      )}
                    </button>

                    {/* إبلاغ عن رسالة لاعب — زر منفصل (مش جوه زر الإشعار) */}
                    {n.type === 'message' && n.related_id && (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setBlockError('');
                          setBlockTarget({ userId: n.related_id, name: (n.title || '').replace('رسالة جديدة من ', '') });
                        }}
                        className="flex-shrink-0 w-11 h-11 mt-1 flex items-center justify-center press-effect no-tap-highlight"
                        aria-label="حظر هذا اللاعب"
                      >
                        <i className="fi fi-rr-ban" aria-hidden="true" style={{ fontSize: '14px', color: '#B91C1C' }} />
                      </button>
                    )}
                    {n.type === 'message' && n.related_id && (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setReportTarget({ userId: n.related_id, notificationId: n.id });
                        }}
                        className="flex-shrink-0 w-11 h-11 mt-1 flex items-center justify-center press-effect no-tap-highlight"
                        aria-label="إبلاغ عن هذه الرسالة"
                      >
                        <i className="fi fi-rr-flag" aria-hidden="true" style={{ fontSize: '14px', color: '#8B5A2B' }} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {blockTarget && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" role="alertdialog" aria-label="تأكيد الحظر">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !blockBusy && setBlockTarget(null)} />
          <div className="relative w-full max-w-sm rounded-3xl p-6" style={{ backgroundColor: '#FDF3E3', fontFamily: "'Cairo', sans-serif" }} dir="rtl">
            <h2 className="font-black text-base mb-2 text-center" style={{ color: '#3D2B1F' }}>حظر {blockTarget.name || 'هذا اللاعب'}؟</h2>
            <p className="text-xs text-center mb-4 leading-relaxed" style={{ color: '#6B4A1F' }}>
              مش هيقدر يبعتلك رسائل أو دعوات، وهتتشال رسائله من إشعاراتك. تقدر ترفع الحظر من الإعدادات.
            </p>
            {blockError && <p role="alert" className="text-xs font-bold text-center mb-3" style={{ color: '#B91C1C' }}>{blockError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setBlockTarget(null)} disabled={blockBusy} className="flex-1 py-3 rounded-xl font-bold" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>إلغاء</button>
              <button onClick={confirmBlock} disabled={blockBusy} className="flex-1 py-3 rounded-xl font-bold text-white" style={{ backgroundColor: blockBusy ? '#A9793F' : '#B91C1C' }}>
                {blockBusy ? 'جاري الحظر...' : 'حظر'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {reportTarget && (
        <ReportModal
          reportedUserId={reportTarget.userId}
          notificationId={reportTarget.notificationId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default NotificationBell;
