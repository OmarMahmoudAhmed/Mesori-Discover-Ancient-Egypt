/*
 * شاشة "غير متاح" لمن هم أقل من الحد الأدنى للسن. بلهجة محايدة،
 * وبدون ما نشجّع على إعادة المحاولة بإجابة مختلفة.
 */
import React from 'react';

function AgeBlockedScreen({ deleting = false, error = '', onRetry = null }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10"
      style={{ backgroundColor: '#0F2D18', fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
    >
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🏺</div>
        <h1 className="text-xl font-black mb-3" style={{ color: '#F4E2BC' }}>
          عذراً، ميسوري غير متاح لك حالياً
        </h1>
        <p className="text-sm leading-relaxed mb-5" style={{ color: '#D9C089' }}>
          لا نستطيع إنشاء حساب لك في الوقت الحالي. شكراً لتفهّمك.
        </p>
        {deleting && (
          <p className="text-xs mb-3" style={{ color: '#D9C089' }}>جاري إزالة بياناتك…</p>
        )}
        {error && (
          <>
            <p className="text-sm font-semibold mb-3" style={{ color: '#FCA5A5' }}>{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
                style={{ backgroundColor: '#C8922A' }}
              >
                إعادة المحاولة
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AgeBlockedScreen;
