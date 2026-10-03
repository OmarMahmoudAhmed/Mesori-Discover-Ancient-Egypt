/*
 * =====================================================
 * PlayerProfileModal.jsx - نافذة بروفايل لاعب من الليدربورد
 * =====================================================
 * تظهر عند الضغط على أي لاعب في قائمة المتصدرين. تعرض أفاتاره
 * وشاراته، مع زر لإرسال رسالة مباشرة له.
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarDisplay } from '../../data/avatars';
import { BadgeIcon } from '../shared/BadgeIcon';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';

function PlayerProfileModal({ player, onClose }) {
  const { sendMessage } = useApp();

  const [badges, setBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendState, setSendState] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    if (!player) return;
    setLoadingBadges(true);
    supabase
      .from('user_badges')
      .select('badge_id, badges (id, title_ar, icon)')
      .eq('user_id', player.id)
      .then(({ data, error }) => {
        if (error) { console.error('❌ خطأ في تحميل شارات اللاعب:', error); return; }
        setBadges((data || []).map(row => ({ id: row.badges.id, title: row.badges.title_ar, icon: row.badges.icon })));
        setLoadingBadges(false);
      });
  }, [player]);

  if (!player) return null;

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSendState('sending');
    const { error } = await sendMessage(player.id, messageText.trim());
    if (error) {
      setSendState('error');
    } else {
      setSendState('sent');
      setMessageText('');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md rounded-t-3xl p-6 pb-8"
          style={{ backgroundColor: '#FDF3E3', fontFamily: "'Cairo', sans-serif" }}
        >
          <button
            onClick={onClose}
            className="absolute left-4 top-4 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(200,146,42,0.15)' }}
            aria-label="إغلاق"
          >
            <i className="fi fi-rr-cross" aria-hidden="true" style={{ fontSize: '13px', color: '#8B5A2B' }} />
          </button>

          {!isComposing ? (
            <>
              {/* رأس البروفايل */}
              <div className="flex flex-col items-center text-center mb-5">
                <AvatarDisplay avatarKey={player.avatar} size={72} />
                <div className="flex items-center gap-1.5 mt-3">
                  <h2 className="font-black text-lg" style={{ color: '#3D2B1F' }}>
                    {player.name}
                  </h2>
                  {player.gender && (
                    <i
                      className={`fi ${player.gender === 'male' ? 'fi-sr-mars' : 'fi-sr-venus'}`}
                      aria-hidden="true"
                      style={{ fontSize: '14px', color: player.gender === 'male' ? '#1A7F8E' : '#C2185B' }}
                    />
                  )}
                </div>
                <div className="flex gap-4 mt-2">
                  <span className="text-xs font-bold" style={{ color: '#8B5A2B' }}>
                    المستوى {player.levelReached}
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#805D1B' }}>
                    {player.points} نقطة
                  </span>
                </div>
              </div>

              {/* الشارات */}
              <div className="mb-5">
                <p className="font-bold text-sm mb-2" style={{ color: '#3D2B1F' }}>الشارات</p>
                {loadingBadges ? (
                  <p className="text-xs" style={{ color: '#8B5A2B' }}>جاري التحميل...</p>
                ) : badges.length === 0 ? (
                  <p className="text-xs" style={{ color: '#8B5A2B' }}>لسه ما كسبش أي شارة</p>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {badges.map(b => (
                      <div key={b.id} className="flex flex-col items-center gap-1 w-14">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(200,146,42,0.15)' }}>
                          <BadgeIcon icon={b.icon} size={18} />
                        </div>
                        <span className="text-[9px] font-bold text-center leading-tight" style={{ color: '#3D2B1F' }}>{b.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsComposing(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
                style={{ backgroundColor: '#C8922A' }}
              >
                <i className="fi fi-rr-paper-plane" aria-hidden="true" style={{ fontSize: '14px' }} />
                <span>إرسال رسالة</span>
              </button>
            </>
          ) : (
            <>
              <h2 className="font-black text-base mb-4 text-center" style={{ color: '#3D2B1F' }}>
                رسالة إلى {player.name}
              </h2>

              {sendState === 'sent' ? (
                <div className="text-center py-6">
                  <i className="fi fi-sr-check-circle" aria-hidden="true" style={{ fontSize: '36px', color: '#2D6A3F' }} />
                  <p className="font-bold text-sm mt-3" style={{ color: '#2D6A3F' }}>تم إرسال الرسالة!</p>
                  <button onClick={onClose} className="mt-4 text-sm font-bold" style={{ color: '#8B5A2B' }}>إغلاق</button>
                </div>
              ) : (
                <>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    maxLength={500}
                    rows={4}
                    className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                    style={{ backgroundColor: 'white', border: '1px solid rgba(200,146,42,0.3)', color: '#3D2B1F' }}
                  />
                  {sendState === 'error' && (
                    <p className="text-xs font-bold text-center mt-2" style={{ color: '#DC2626' }}>
                      حصلت مشكلة في الإرسال، حاول تاني
                    </p>
                  )}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setIsComposing(false)}
                      className="flex-1 py-3 rounded-xl font-bold"
                      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                    >
                      رجوع
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sendState === 'sending' || !messageText.trim()}
                      className="flex-1 py-3 rounded-xl font-bold text-white"
                      style={{ backgroundColor: sendState === 'sending' ? '#A9793F' : '#2D6A3F' }}
                    >
                      {sendState === 'sending' ? 'جاري الإرسال...' : 'إرسال'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PlayerProfileModal;
