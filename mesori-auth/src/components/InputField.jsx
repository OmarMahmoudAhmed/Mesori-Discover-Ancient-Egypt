import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff } from 'react-icons/fi';

/**
 * متغيرات الحركة الخاصة بكل حقل — تُستخدم أيضًا من AuthCard
 * لتنسيق ظهور الحقول (Stagger) داخل نفس الحاوية الأب.
 */
export const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/**
 * InputField
 * حقل إدخال قابل لإعادة الاستخدام (البريد الإلكتروني / كلمة المرور / الاسم ...)
 *
 * Props:
 * - icon: عنصر أيقونة يظهر في بداية الحقل
 * - type: نوع الحقل الافتراضي (يُتجاهل إذا showToggle = true)
 * - showToggle: يفعّل زر إظهار/إخفاء كلمة المرور
 */
const InputField = ({
  icon: Icon,
  type = 'text',
  name,
  placeholder,
  value,
  onChange,
  showToggle = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const inputType = showToggle ? (isVisible ? 'text' : 'password') : type;

  return (
    <motion.div className="input-field" variants={fieldVariants}>
      {Icon && <Icon className="input-field__icon" />}

      <input
        className="input-field__input"
        type={inputType}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
      />

      {showToggle && (
        <button
          type="button"
          className="input-field__toggle"
          onClick={() => setIsVisible((prev) => !prev)}
          aria-label={isVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          {isVisible ? <FiEyeOff size={20} /> : <FiEye size={20} />}
        </button>
      )}
    </motion.div>
  );
};

export default InputField;
