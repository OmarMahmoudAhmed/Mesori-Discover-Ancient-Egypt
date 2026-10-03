/*
 * =====================================================
 * BottomNav.jsx - شريط تنقل سفلي (أيقونات + زجاج خفيف)
 * =====================================================
 *
 * - أيقونات فقط بدون نصوص.
 * - تأثير زجاجي معتدل وبسيط.
 * - شريط نحيف وثابت دائماً في الأسفل.
 */

import React from 'react';
import { useApp } from '../../context/AppContext';

function BottomNav({ activePage = 'home' }) {
  const { navigateTo } = useApp();

  const navItems = [
    { id: 'profile', page: 'profile', iconClass: 'fi fi-rr-info', label: 'معلوماتي' },
    { id: 'home', page: 'home', iconClass: 'fi fi-rr-home', label: 'الرئيسية' },
    { id: 'leaderboard', page: 'leaderboard', iconClass: 'fi fi-rr-leaderboard', label: 'المتصدرين' },
  ];

  return (
    <nav
      dir="ltr"
      className="fixed bottom-0 z-50 rounded-t-2xl"
      style={{
        width: 'min(100%, 448px)',
        left: '50%',
        transform: 'translateX(-50%)',

        /* تأثير زجاجي خفيف ومتناسق */
        background: 'rgba(253, 246, 227, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 -4px 12px rgba(62, 39, 35, 0.12)',
      }}
    >
      <div
        className="flex items-center justify-around px-2 pt-1.5"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {navItems.map((item) => {
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.page)}
              className="flex items-center justify-center press-effect no-tap-highlight w-14 h-14 relative"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* دائرة زجاجية خفيفة جداً للعنصر النشط */}
              {isActive && (
                <span
                  className="absolute inset-0 m-auto w-10 h-10 rounded-full"
                  style={{
                    background: 'rgba(255, 255, 255, 0.35)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 2px 8px rgba(200, 146, 42, 0.15)',
                  }}
                />
              )}

              <i
                className={item.iconClass}
                aria-hidden="true"
                style={{
                  fontSize: '22px',
                  /* اللونين القديمين (C8922A / A3906C) كانوا بيفشلوا حتى حد
                     تباين الأيقونات (3:1) فوق شريط الزجاج شبه الشفاف —
                     اتقاسوا بالتركيب الفعلي مش تخمين. النسخة الجديدة داكنة
                     كفاية إنها تتقرا، والدائرة الزجاجية + التكبير الخفيف +
                     الظل بيفرّقوا النشط عن الباقي برضه مش بس اللون */
                  color: isActive ? '#A87B23' : '#938261',
                  filter: isActive ? 'drop-shadow(0 1px 3px rgba(200, 146, 42, 0.3))' : 'none',
                  zIndex: 1,
                  transition: 'all 0.2s ease',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;