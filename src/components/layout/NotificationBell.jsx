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
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, navigateTo } = useApp();
  const [isOpen, setIsOpen] = useState(false);

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
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      if ((n.type === 'match_invite' || n.type === 'match_result') && n.related_id) {
                        setIsOpen(false);
                        navigateTo('vs-match', { matchId: n.related_id });
                      }
                    }}
                    className="w-full flex items-start gap-2.5 px-4 py-3 text-right press-effect no-tap-highlight"
                    style={{ borderBottom: '1px solid rgba(200,146,42,0.08)', backgroundColor: n.read_at ? 'transparent' : 'rgba(200,146,42,0.06)' }}
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
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationBell;
