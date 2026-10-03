/*
 * =====================================================
 * LoadingAnkh.jsx - أيقونة تحميل متحركة (عنخ ذهبي)
 * =====================================================
 * تحل محل إيموجي 🏺 القديم في شاشة التحميل (SplashLoader في
 * App.jsx). إيموجي نظام التشغيل بيتقلّب شكله من جهاز لآخر (Android
 * وiOS ومتصفحات مختلفة بيرسموه بأسلوب مختلف تماماً)، فبقى SVG
 * حقيقي بنفس شكل عنخ الشعار الأساسي (public/ankh.svg، وهو نفسه
 * الأيقونة المفضّلة/favicon للتطبيق في index.html) — هوية بصرية
 * واحدة متسقة بدل إيموجي عشوائي الشكل.
 *
 * توهّج ذهبي نابض (نفس keyframe الـ pulse-gold المُعرّف بالفعل في
 * tailwind.config.js) + لمعة تمر فوقه + تنفّس خفيف بالحجم، بدل
 * تدوير كامل 360° — شكل العنخ غير متماثل (حلقة أعلى + ذراعين)
 * فتدويره بالكامل بيبان غريب بصرياً وقت ما يبقى مقلوب أو مايل.
 *
 * تحترم إعداد "تقليل الحركة" (prefers-reduced-motion) عبر
 * useReducedMotion من framer-motion (مكتبة مُستخدمة بالفعل في
 * عدة مكوّنات أخرى بالمشروع).
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

function LoadingAnkh({ size = 72 }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size * 1.8, height: size * 1.8 }}
    >
      {/* توهّج ذهبي نابض خلف العنخ */}
      <div
        className={prefersReducedMotion ? '' : 'animate-pulse-gold'}
        style={{
          position: 'absolute',
          width: size * 1.3,
          height: size * 1.3,
          borderRadius: '9999px',
          backgroundColor: 'rgba(200,146,42,0.28)',
        }}
      />

      {/* العنخ نفسه: تنفّس خفيف بالحجم/الشفافية بدل دوران كامل */}
      <motion.div
        animate={prefersReducedMotion ? {} : { scale: [1, 1.07, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', width: size, height: size, overflow: 'hidden', borderRadius: '10px' }}
      >
        {/*
          * نفس هندسة public/ankh.svg بالظبط (حلقة + ذراع رأسي + ذراع
          * أفقي)، لكن بلون ذهبي فاتح (pharaoh.gold-pale = #F0D080)
          * بدل الذهبي الأساسي #C8922A — تباين أفضل فوق خلفية شاشة
          * التحميل الداكنة (#0F2D18) من الشاشة الفاتحة اللي صُمم لها
          * اللون الأساسي أصلاً.
          */}
        <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block' }}>
          <circle cx="32" cy="14" r="10" fill="none" stroke="#F0D080" strokeWidth="7" />
          <rect x="28.5" y="22" width="7" height="42" rx="3.5" fill="#F0D080" />
          <rect x="18" y="27" width="28" height="7" rx="3.5" fill="#F0D080" />
        </svg>

        {/* لمعة تمر فوق العنخ بشكل دوري */}
        {!prefersReducedMotion && (
          <motion.div
            initial={{ x: '-120%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)',
              mixBlendMode: 'overlay',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

export default LoadingAnkh;
