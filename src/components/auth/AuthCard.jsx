import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser } from 'react-icons/fi';
import InputField, { fieldVariants } from './InputField';
import GoldenButton from './GoldenButton';
import { useApp } from '../../context/AppContext';

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
 * مرتبطة بـ Supabase Auth الحقيقي عبر useApp() (signIn/signUp من AppContext).
 * أزرار جوجل/فيسبوك/آبل (SocialLogin) لسه غير مفعّلة — تحتاج إعداد
 * مزوّدين خارجيين (OAuth apps) من لوحة تحكم كل مزوّد + Supabase
 * Dashboard، وده خارج نطاق هذه المهمة.
 */
const AuthCard = ({ activeTab }) => {
  const { signIn, signUp } = useApp();

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error,      setError]      = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  /* رسائل خطأ Supabase تيجي بالإنجليزي — نترجم الشائع منها فقط */
  const translateAuthError = (message) => {
    if (!message) return 'حصلت مشكلة، حاول تاني';
    if (message.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غلط';
    if (message.includes('User already registered')) return 'في حساب مسجّل بالفعل بهذا البريد';
    if (message.includes('Password should be at least')) return 'كلمة المرور لازم تكون 6 حروف على الأقل';
    if (message.includes('Unable to validate email')) return 'صيغة البريد الإلكتروني غير صحيحة';
    return message;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!loginData.email || !loginData.password) {
      setError('من فضلك اكتب البريد الإلكتروني وكلمة المرور');
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await signIn(loginData.email.trim(), loginData.password);
    setSubmitting(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
    }
    // لو نجح: onAuthStateChange في AppContext هيحدّث session تلقائياً،
    // وApp.jsx هينقل المستخدم للصفحة المناسبة من غير أي navigate هنا
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!signupData.name.trim() || !signupData.email || !signupData.password) {
      setError('من فضلك املأ كل الحقول');
      return;
    }
    if (signupData.password.length < 6) {
      setError('كلمة المرور لازم تكون 6 حروف على الأقل');
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      setError('كلمة المرور وتأكيدها مش متطابقين');
      return;
    }

    setSubmitting(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp(
      signupData.email.trim(),
      signupData.password,
      signupData.name.trim()
    );
    setSubmitting(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
    } else if (needsEmailConfirmation) {
      setInfoMessage('تم إنشاء الحساب! افتح بريدك الإلكتروني واضغط رابط التفعيل عشان تقدر تسجّل دخول.');
    }
    // لو نجح وفيه جلسة نشطة فوراً: onAuthStateChange في AppContext
    // هيحدّث session تلقائياً، وApp.jsx هينقل المستخدم للصفحة المناسبة
  };

  return (
    <div className="auth-card">
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-card__error"
          role="alert"
        >
          {error}
        </motion.p>
      )}
      {infoMessage && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-card__info"
          role="status"
        >
          {infoMessage}
        </motion.p>
      )}
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
              <GoldenButton type="submit" disabled={submitting}>
                {submitting ? 'جاري الدخول...' : 'ابدأ الرحلة'}
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
              <GoldenButton type="submit" disabled={submitting}>
                {submitting ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </GoldenButton>
            </motion.div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthCard;
