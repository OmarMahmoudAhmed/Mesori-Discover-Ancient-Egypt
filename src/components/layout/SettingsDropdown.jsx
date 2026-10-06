/*
 * =====================================================
 * SettingsDropdown.jsx - القائمة المنسدلة للإعدادات
 * =====================================================
 * تظهر عند الضغط على أيقونة الترس ⚙️ في Header.jsx.
 * تشمل: مستوى الصوت، معلومات عن المطوّر، رابط دعم، السياسات والخصوصية،
 * وحذف الحساب (للمسجّلين فقط).
 *
 * رابط سياسة الخصوصية: صفحة GitHub Pages الحيّة (مطلوب من Google Play
 * إنها تكون متاحة من داخل التطبيق). تقدر تغيّره بدون تعديل الكود عن طريق
 * متغيّر البيئة VITE_PRIVACY_POLICY_URL.
 * =====================================================
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import DeleteAccountModal from '../shared/DeleteAccountModal';
import BlockedUsersModal from '../shared/BlockedUsersModal';
import LegalModal from '../shared/LegalModal';
import { isPrivacyOptionsRequired, openPrivacyOptions } from '../../lib/ads';

const SUPPORT_URL = 'https://buymeacoffee.com/omarmahmoudahmed'; // ⬅️ بدّله برابط الدعم الحقيقي (Patreon/GoFundMe)
function SettingsDropdown({ isOpen, onClose }) {
  const { isSoundOn, toggleSound, navigateTo, session } = useApp();
  const [showDelete, setShowDelete] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const menuItems = [
    {
      key: 'sound',
      icon: isSoundOn ? 'fi-rr-volume' : 'fi-rr-volume-mute',
      label: isSoundOn ? 'الصوت مُفعّل' : 'الصوت مكتوم',
      onClick: toggleSound,
      keepOpen: true, // ما يقفلش القائمة عشان تقدر تجرّب تشغيل/كتم أكتر من مرة
    },
    {
      key: 'info',
      icon: 'fi-rr-info',
      label: 'عن المطوّر',
      onClick: () => navigateTo('developer-info'),
    },
    {
      key: 'support',
      icon: 'fi-rr-heart',
      label: 'ادعم ميسوري',
      onClick: () => window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'legal',
      icon: 'fi-rr-shield-check',
      label: 'الخصوصية وشروط الاستخدام',
      onClick: () => setShowLegal(true),
    },
    // خيارات موافقة الإعلانات (UMP): بتظهر بس لو Google قالت إنها مطلوبة (أوروبا/UK)
    ...(isPrivacyOptionsRequired() ? [{
      key: 'ad-privacy',
      icon: 'fi-rr-shield-check',
      label: 'خيارات الإعلانات والخصوصية',
      onClick: () => { void openPrivacyOptions(); },
    }] : []),
    // اللاعبون المحظورون: للمسجّلين فقط
    ...(session?.user?.id ? [{
      key: 'blocked-users',
      icon: 'fi-rr-user-slash',
      label: 'اللاعبون المحظورون',
      onClick: () => setShowBlocked(true),
    }] : []),
  ];

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* طبقة شفافة تقفل القائمة عند الضغط برّاها */}
            <motion.div
              className="fixed inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-14 z-40 w-56 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden origin-top-right"
              style={{ backgroundColor: 'white', boxShadow: '0 8px 24px rgba(61,43,31,0.2)', border: '1px solid rgba(200,146,42,0.15)' }}
            >
            {menuItems.map((item, idx) => (
              <button
                key={item.key}
                onClick={() => { item.onClick(); if (!item.keepOpen) onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 press-effect no-tap-highlight transition-colors duration-150"
                style={{
                  borderBottom: idx < menuItems.length - 1 ? '1px solid rgba(200,146,42,0.1)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(200,146,42,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <i className={`fi ${item.icon}`} aria-hidden="true" style={{ fontSize: '18px', color: item.danger ? '#B91C1C' : '#805D1B' }} />
                <span className="font-bold text-sm" style={{ fontFamily: "'Cairo', sans-serif", color: item.danger ? '#B91C1C' : '#3D2B1F' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {showLegal && <LegalModal onClose={() => setShowLegal(false)} onDeleteAccount={() => { setShowLegal(false); setShowDelete(true); }} />}
    {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    {showBlocked && <BlockedUsersModal onClose={() => setShowBlocked(false)} />}
    </>
  );
}

export default SettingsDropdown;
