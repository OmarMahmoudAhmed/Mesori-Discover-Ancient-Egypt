/*
 * =====================================================
 * Header.jsx - رأس الصفحة العلوي
 * =====================================================
 *
 * الصفحة الرئيسية (Home):
 * ┌────────────────────────────────────────┐
 * │  🔔 (إشعارات)   ⚔️ (1 ضد 1)   ⚙️ (إعدادات) │
 * └────────────────────────────────────────┘
 *
 * باقي الصفحات (Quiz, Leaderboard, Profile):
 * ┌────────────────────────────────────┐
 * │  >   (رجوع)              ⚙️ (إعدادات) │
 * └────────────────────────────────────┘
 *
 * الخصائص (Props):
 * @prop showBack          {boolean} - هل نعرض زر الرجوع؟
 * @prop showNotifications {boolean} - هل نعرض جرس الإشعارات؟ (بدل زر الصوت القديم)
 * @prop showVsIcon        {boolean} - هل نعرض أيقونة "1 ضد 1" في المنتصف؟
 * @prop onBack            {function} - دالة الرجوع (اختياري)
 * =====================================================
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import NotificationBell from './NotificationBell';
import SettingsDropdown from './SettingsDropdown';

function Header({ showBack = false, showNotifications = false, showVsIcon = false, onBack = null }) {

  const { goBack, navigateTo } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };

  return (
    <header
      dir="ltr"
      className="
        flex items-center justify-between
        px-4 pb-3
        relative z-10
      "
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      {/* ===== الزر الأيسر (رجوع أو جرس الإشعارات) ===== */}
      {showBack ? (
        <button
          onClick={handleBack}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-card press-effect no-tap-highlight active:scale-95 transition-transform duration-100"
          aria-label="رجوع للصفحة السابقة"
        >
          <i className="fi fi-rr-arrow-right" aria-hidden="true" style={{ fontSize: '22px', color: '#3D2B1F' }} />
        </button>

      ) : showNotifications ? (
        <NotificationBell />

      ) : (
        <div className="w-12 h-12" />
      )}

      {/* ===== المنتصف: أيقونة "1 ضد 1" (الصفحة الرئيسية فقط) ===== */}
      {showVsIcon ? (
        <button
          onClick={() => navigateTo('vs-lobby')}
          className="w-14 h-14 rounded-2xl flex items-center justify-center press-effect no-tap-highlight transition-transform duration-100"
          style={{ backgroundColor: '#7A1F1F', boxShadow: '0 4px 14px rgba(122,31,31,0.4)' }}
          aria-label="نمط اللعب 1 ضد 1"
        >
          <i className="fi fi-sr-sword" aria-hidden="true" style={{ fontSize: '22px', color: '#FDBA74' }} />
        </button>
      ) : (
        <div />
      )}

      {/* ===== الزر الأيمن: الإعدادات (⚙️) ===== */}
      <div className="relative">
        <button
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-card press-effect no-tap-highlight transition-transform duration-100"
          aria-label="الإعدادات"
          onClick={() => setIsSettingsOpen(prev => !prev)}
        >
          <i className="fi fi-rr-settings" aria-hidden="true" style={{ fontSize: '22px', color: '#3D2B1F' }} />
        </button>
        <SettingsDropdown isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </header>
  );
}

export default Header;