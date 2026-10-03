import React, { useState } from 'react';
import { motion } from 'framer-motion';

/* أيقونة الجناحين الثابتة على جانبي نص الزر (بدل الأيقونة المرسومة يدوياً سابقاً) */
const WINGS_ICON_SRC = '/assets/icons/badges/Mummy.svg';

/**
 * GoldenButton
 * الزر الذهبي الرئيسي (ابدأ الرحلة / إنشاء الحساب)
 *
 * يجمع بين:
 * - Gradient متحرك + توهج ذهبي (مُعرَّفان في login.css / animations.css)
 * - Scale عند الـ Hover والضغط (Framer Motion)
 * - تأثير Ripple عند الضغط (JS بسيط + CSS keyframes)
 * - جناحا Isis على الجانبين (نفس ملف SVG، الجانب الأيمن معكوس أفقياً
 *   بالـ CSS بدل تكرار الملف)
 *
 * Props:
 * - disabled: تعطيل الزر (يُستخدم أثناء انتظار رد الخادم)
 * - showWings: إظهار/إخفاء الجناحين الزخرفيين (افتراضياً true)
 */
const GoldenButton = ({ children, type = 'button', onClick, disabled = false, showWings = true }) => {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const newRipple = {
      id: Date.now() + Math.random(),
      x: e.clientX - rect.left - size / 2,
      y: e.clientY - rect.top - size / 2,
      size,
    };
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 650);

    if (onClick) onClick(e);
  };

  return (
    <motion.button
      type={type}
      className="golden-button"
      onClick={handleClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
    >
      {showWings && (
        <img src={WINGS_ICON_SRC} alt="" aria-hidden="true" className="golden-button__wing golden-button__wing--left" />
      )}
      <span>{children}</span>
      {showWings && (
        <img src={WINGS_ICON_SRC} alt="" aria-hidden="true" className="golden-button__wing golden-button__wing--right" />
      )}

      {ripples.map((r) => (
        <span
          key={r.id}
          className="golden-button__ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </motion.button>
  );
};

export default GoldenButton;
