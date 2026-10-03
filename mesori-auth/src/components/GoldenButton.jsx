import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * GoldenButton
 * الزر الذهبي الرئيسي (ابدأ الرحلة / إنشاء الحساب)
 *
 * يجمع بين:
 * - Gradient متحرك + توهج ذهبي (مُعرَّفان في login.css / animations.css)
 * - Scale عند الـ Hover والضغط (Framer Motion)
 * - تأثير Ripple عند الضغط (JS بسيط + CSS keyframes)
 *
 * Props:
 * - leftIcon / rightIcon: أيقونات زخرفية اختيارية على جانبي النص
 */
const GoldenButton = ({ children, type = 'button', onClick, leftIcon: LeftIcon, rightIcon: RightIcon }) => {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
    >
      {LeftIcon && <LeftIcon className="golden-button__wing" />}
      <span>{children}</span>
      {RightIcon && <RightIcon className="golden-button__wing" />}

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
