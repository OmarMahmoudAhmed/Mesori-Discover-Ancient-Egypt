import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser } from 'react-icons/fi';
import InputField, { fieldVariants } from './InputField';
import GoldenButton from './GoldenButton';

/**
 * أيقونة جناحين زخرفية (مستوحاة من الجُعران المجنّح) — مرسومة يدويًا كـ SVG
 * تُستخدم على جانبي نص الزر الرئيسي، لعدم توفر رمز مشابه في المكتبات الجاهزة
 */
const WingIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M2 12c3-4.2 6.2-4.2 8.2-1.8M22 12c-3-4.2-6.2-4.2-8.2-1.8M10.2 10.2c1 2.2 1 4.4 0 6.2M13.8 10.2c-1 2.2-1 4.4 0 6.2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const formTransition = {
  initial: { opacity: 0, y: 14 },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

/**
 * AuthCard
 * البطاقة الرئيسية التي تعرض نموذج "تسجيل الدخول" أو "إنشاء حساب"
 * بحسب التبويب النشط (activeTab)، مع Stagger لظهور الحقول وانتقال ناعم عند التبديل.
 *
 * ⚠️ لا يوجد أي ربط بقاعدة بيانات أو منطق مصادقة حقيقي هنا حاليًا.
 * كل دوال الإرسال (handleLoginSubmit / handleSignupSubmit) عبارة عن stubs فارغة
 * سيتم استكمالها لاحقًا (على الأرجح عبر Supabase Auth).
 */
const AuthCard = ({ activeTab }) => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  // TODO: ربط هذه الدالة بمنطق تسجيل الدخول الفعلي لاحقًا
  const handleLoginSubmit = (e) => {
    e.preventDefault();
  };

  // TODO: ربط هذه الدالة بمنطق إنشاء الحساب الفعلي لاحقًا
  const handleSignupSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="auth-card">
      <AnimatePresence mode="wait">
        {activeTab === 'login' ? (
          <motion.form
            key="login"
            className="auth-card__form"
            onSubmit={handleLoginSubmit}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={formTransition.exit}
          >
            <InputField
              icon={FiMail}
              type="email"
              name="email"
              placeholder="البريد الإلكتروني"
              value={loginData.email}
              onChange={handleLoginChange}
            />
            <InputField
              icon={FiLock}
              name="password"
              placeholder="كلمة المرور"
              value={loginData.password}
              onChange={handleLoginChange}
              showToggle
            />

            <motion.button type="button" className="auth-card__forgot" variants={fieldVariants}>
              نسيت كلمة المرور؟
            </motion.button>

            <motion.div className="auth-card__submit-wrap" variants={fieldVariants}>
              <GoldenButton type="submit" leftIcon={WingIcon} rightIcon={WingIcon}>
                ابدأ الرحلة
              </GoldenButton>
            </motion.div>
          </motion.form>
        ) : (
          <motion.form
            key="signup"
            className="auth-card__form"
            onSubmit={handleSignupSubmit}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={formTransition.exit}
          >
            <InputField
              icon={FiUser}
              name="name"
              placeholder="الاسم بالكامل"
              value={signupData.name}
              onChange={handleSignupChange}
            />
            <InputField
              icon={FiMail}
              type="email"
              name="email"
              placeholder="البريد الإلكتروني"
              value={signupData.email}
              onChange={handleSignupChange}
            />
            <InputField
              icon={FiLock}
              name="password"
              placeholder="كلمة المرور"
              value={signupData.password}
              onChange={handleSignupChange}
              showToggle
            />
            <InputField
              icon={FiLock}
              name="confirmPassword"
              placeholder="تأكيد كلمة المرور"
              value={signupData.confirmPassword}
              onChange={handleSignupChange}
              showToggle
            />

            <motion.div className="auth-card__submit-wrap" variants={fieldVariants}>
              <GoldenButton type="submit" leftIcon={WingIcon} rightIcon={WingIcon}>
                إنشاء الحساب
              </GoldenButton>
            </motion.div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthCard;
