/*
 * بوابة السن: بتظهر قبل شاشة الدخول لأي مستخدم مش مسجّل. السؤال محايد
 * ("كم عمرك؟") ومفيهوش أي تلميح للحد الأدنى. راجع src/lib/ageGate.js.
 */
import React, { useState } from 'react';
import { evaluateAge, markAgeGatePassed, markDeviceAgeBlocked } from '../../lib/ageGate';

function AgeGate({ onPassed, onBlocked }) {
  const [age, setAge] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = evaluateAge(age);
    if (result === 'invalid') {
      setError('من فضلك اكتب عمرك بالأرقام');
      return;
    }
    if (result === 'under') {
      markDeviceAgeBlocked();
      onBlocked();
      return;
    }
    markAgeGatePassed();
    onPassed();
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10"
      style={{ backgroundColor: '#0F2D18', fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏺</div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#F4E2BC' }}>أهلاً بيك في ميسوري</h1>
          <p className="text-sm" style={{ color: '#D9C089' }}>قبل ما نكمّل، محتاجين نعرف عمرك</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-6"
          style={{ backgroundColor: '#FDF3E3', border: '1px solid rgba(200,146,42,0.25)' }}
        >
          <label className="block font-bold text-sm mb-2" style={{ color: '#3D2B1F' }}>كم عمرك؟</label>
          <input
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => { setAge(e.target.value); setError(''); }}
            placeholder="اكتب عمرك"
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none mb-4"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(200,146,42,0.3)', color: '#3D2B1F' }}
          />
          {error && (
            <p className="text-sm font-semibold text-center mb-4" style={{ color: '#DC2626' }}>{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
            style={{ backgroundColor: '#C8922A' }}
          >
            متابعة
          </button>
        </form>
      </div>
    </div>
  );
}

export default AgeGate;
