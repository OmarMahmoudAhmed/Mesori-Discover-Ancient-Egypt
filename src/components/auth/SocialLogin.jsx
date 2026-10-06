import React from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
// فيسبوك وآبل متوقفين مؤقتاً (راجع الملاحظة تحت) — رجّع السطر ده لما يترجعوا
// import { FaFacebookF, FaApple } from 'react-icons/fa';


/**
 * SocialLogin
 * قسم "أو سجل الدخول باستخدام" + أزرار جوجل / فيسبوك / آبل
 *
 * جوجل مفعّل (أصلي على Android / OAuth على الويب). فيسبوك وآبل متوقفان مؤقتاً.
 */

import { useState } from 'react';
import { signInWithGoogle, GoogleAuthError, GOOGLE_AUTH_ERRORS } from '../../lib/googleAuth';

const SocialLogin = () => {
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  /*
   * جوجل: على Android تسجيل دخول أصلي + signInWithIdToken، وعلى الويب redirect عادي.
   * راجع src/lib/googleAuth.js. لا يُسجَّل أي token.
   */
  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await signInWithGoogle();
    } catch (error) {
      const code = error instanceof GoogleAuthError ? error.code : 'UNKNOWN';
      // الإلغاء من المستخدم ليس خطأً يستحق رسالة
      if (code !== 'CANCELLED') setErrorMsg(GOOGLE_AUTH_ERRORS[code]);
    } finally {
      setBusy(false);
    }
  };
  /*
   * فيسبوك وآبل متوقفين مؤقتاً (مش محذوفين) — لسه ماجبناش الـ OAuth
   * API بتاعهم. لما تتوفر مفاتيحهم، رجّع السطرين دول وعنصريهم في
   * providers تحت زي ما كانوا.
   */
  // const handleFacebook = () => {};
  // const handleApple = () => {};

  const providers = [
    { id: 'google', label: 'Google', icon: FcGoogle, onClick: handleGoogle },
    // { id: 'facebook', label: 'Facebook', icon: FaFacebookF, onClick: handleFacebook, color: '#1877F2' },
    // { id: 'apple', label: 'Apple', icon: FaApple, onClick: handleApple, color: '#1A1A1A' },
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
            disabled={busy}
          >
            <Icon color={color} />
          </motion.button>
        ))}
      </div>

      {errorMsg && (
        <p className="social-login__error" role="alert">
          {errorMsg}
        </p>
      )}
    </motion.div>
  );
};

export default SocialLogin;
