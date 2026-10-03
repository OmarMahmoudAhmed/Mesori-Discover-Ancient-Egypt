import React from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebookF, FaApple } from 'react-icons/fa';

/**
 * SocialLogin
 * قسم "أو سجل الدخول باستخدام" + أزرار جوجل / فيسبوك / آبل
 *
 * ملاحظة مهمة: لم يتم ربط أي منطق مصادقة فعلي بعد (onClick فارغة/placeholder)
 * سيتم توصيلها بمزوّدي OAuth الحقيقيين (مثلًا عبر Supabase Auth) في مرحلة لاحقة.
 */
const SocialLogin = () => {
  // TODO: استبدال هذه الدوال الفارغة بمنطق تسجيل الدخول الفعلي عبر كل مزوّد
  const handleGoogle = () => {};
  const handleFacebook = () => {};
  const handleApple = () => {};

  const providers = [
    { id: 'google', label: 'Google', icon: FcGoogle, onClick: handleGoogle },
    { id: 'facebook', label: 'Facebook', icon: FaFacebookF, onClick: handleFacebook, color: '#1877F2' },
    { id: 'apple', label: 'Apple', icon: FaApple, onClick: handleApple, color: '#1A1A1A' },
  ];

  return (
    <motion.div
      className="social-login"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.5, ease: 'easeOut' }}
    >
      <div className="social-login__divider">
        <span className="social-login__divider-line" />
        <span>أو سجل الدخول باستخدام</span>
        <span className="social-login__divider-line" />
      </div>

      <div className="social-login__buttons">
        {providers.map(({ id, label, icon: Icon, onClick, color }) => (
          <motion.button
            key={id}
            type="button"
            className="social-login__button"
            onClick={onClick}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.92 }}
            aria-label={`تسجيل الدخول عبر ${label}`}
          >
            <Icon color={color} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default SocialLogin;
