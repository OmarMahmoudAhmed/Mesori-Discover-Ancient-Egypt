import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AuthTabs from '../components/AuthTabs';
import AuthCard from '../components/AuthCard';
import SocialLogin from '../components/SocialLogin';
import '../styles/variables.css';
import '../styles/animations.css';
import '../styles/login.css';

/*
 * مسارات الصور — يجب وضع الملفات الفعلية داخل public/assets
 * (لا تضع أي صور داخل src، ولا تستخدم import للصور إطلاقًا)
 */
const APP_LOGO = '/assets/logo/logo.png';
const BACKGROUND_IMAGE = '/assets/backgrounds/auth-bg.jpg';

/**
 * أيقونة زهرة اللوتس — مرسومة يدويًا كـ SVG (رمز مصري قديم غير متوفر في المكتبات الجاهزة)
 * تُستخدم في الفاصل الزخرفي أسفل اسم التطبيق.
 */
const LotusIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M12 20V11M12 11c-2-3-2-6 0-9 2 3 2 6 0 9ZM12 11c-4-1-7 1-9 4 3 1 6 0 9-4ZM12 11c4-1 7 1 9 4-3 1-6 0-9-4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * LoginPage
 * صفحة تسجيل الدخول / إنشاء حساب الرئيسية لتطبيق "ميسوري"
 *
 * تجمع بين: الشعار المتحرك، اسم التطبيق، التبويبات، بطاقة النموذج،
 * تسجيل الدخول عبر السوشيال ميديا، والرسمة الزخرفية السفلية.
 *
 * ⚠️ الصفحة غير متصلة بأي Backend حاليًا — كل المسارات/الدوال فارغة (stubs)
 * وسيتم ربطها لاحقًا (Supabase) في مرحلة منفصلة.
 */
const LoginPage = () => {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="auth-page">
      <div className="auth-page__content">
        {/* ---------- الشعار + اسم التطبيق ---------- */}
        <motion.div
          className="auth-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            className="auth-header__logo-wrap"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: [0, -10, 0],
            }}
            transition={{
              scale: { duration: 0.65, ease: 'backOut' },
              opacity: { duration: 0.6 },
              y: {
                duration: 3.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.65,
              },
            }}
          >
            <img src={APP_LOGO} alt="شعار ميسوري" className="auth-header__logo" />
          </motion.div>

          <h1 className="auth-header__title">ميسوري</h1>

          <div className="auth-header__divider">
            <span className="auth-header__divider-line" />
            <LotusIcon className="auth-header__divider-icon" />
            <span className="auth-header__divider-line" />
          </div>
        </motion.div>

        {/* ---------- التبويبات + بطاقة النموذج ---------- */}
        <motion.div
          style={{ width: '100%' }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
        >
          <AuthTabs activeTab={activeTab} onChange={setActiveTab} />
          <AuthCard activeTab={activeTab} />
        </motion.div>

        {/* ---------- تسجيل الدخول عبر السوشيال ميديا ---------- */}
        <SocialLogin />
      </div>

      {/* ---------- الرسمة الزخرفية السفلية (تملأ عرض الشاشة بالكامل) ---------- */}
      <div
        className="auth-page__bottom-art"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        role="img"
        aria-label="رسمة زخرفية لمعالم مصرية قديمة"
      />
    </div>
  );
};

export default LoginPage;
