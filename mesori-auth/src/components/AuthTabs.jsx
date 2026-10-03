import React from 'react';
import { motion } from 'framer-motion';
import { FaUserPlus } from 'react-icons/fa';

/**
 * أيقونة العنخ (Ankh) — رمز مصري قديم مرسوم يدويًا كـ SVG
 * لعدم توفر هذا الرمز ضمن مكتبات الأيقونات الجاهزة (react-icons / lucide)
 */
const AnkhIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="6.2" r="3.6" stroke="currentColor" strokeWidth="2" />
    <path d="M12 9.8V22M6.8 15H17.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * AuthTabs
 * التبديل بين "تسجيل الدخول" و"إنشاء حساب" مع مؤشر خلفية متحرك (Sliding Indicator)
 * باستخدام layoutId من Framer Motion للانتقال السلس بين التبويبين.
 *
 * ترتيب التبويبين (تسجيل الدخول أولًا من اليمين... لا، من اليسار كما في التصميم المرفق)
 * تم اعتماده مطابقًا تمامًا للصورة المرجعية.
 */
const AuthTabs = ({ activeTab, onChange }) => {
  const tabs = [
    { id: 'login', label: 'تسجيل الدخول', icon: AnkhIcon },
    { id: 'signup', label: 'إنشاء حساب', icon: FaUserPlus },
  ];

  return (
    <div className="auth-tabs" role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`auth-tabs__tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {isActive && (
              <motion.span
                layoutId="auth-tabs-indicator"
                className="auth-tabs__indicator"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className="auth-tabs__tab-icon" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default AuthTabs;
