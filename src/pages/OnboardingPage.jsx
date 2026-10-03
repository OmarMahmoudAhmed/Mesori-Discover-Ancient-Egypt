/*
 * =====================================================
 * OnboardingPage.jsx - شاشة أول استخدام
 * =====================================================
 * تظهر مرة واحدة بس: بعد تسجيل حساب جديد وقبل الدخول لـ HomePage،
 * طالما userProfile.onboardingCompleted لسه false (راجع App.jsx).
 * يختار المستخدم اسمه وعمره وشخصيته، وتُحفظ في Supabase (profiles)
 * عبر completeOnboarding() من AppContext، فما تتكررش تاني بعد كده.
 * =====================================================
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AVATARS, AvatarDisplay } from '../data/avatars';

function OnboardingPage() {
  const { session, completeOnboarding } = useApp();

  const [name, setName] = useState(session?.user?.user_metadata?.name || '');
  const [age, setAge] = useState('');
  const [character, setCharacter] = useState('boy');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const ageNum = parseInt(age, 10);

    if (!trimmedName) {
      setError('من فضلك اكتب اسمك');
      return;
    }
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 100) {
      setError('من فضلك اكتب عمر صحيح (بين 5 و100 سنة)');
      return;
    }
    if (!gender) {
      setError('من فضلك اختار الجنس');
      return;
    }

    setSubmitting(true);
    const { error: submitError } = await completeOnboarding(trimmedName, ageNum, character, gender);
    setSubmitting(false);

    if (submitError) {
      setError('حصلت مشكلة في الحفظ، حاول تاني');
      console.error('❌ فشل حفظ بيانات Onboarding:', submitError);
    }
    // لو نجح: userProfile.onboardingCompleted بقت true تلقائياً،
    // وApp.jsx هينقل المستخدم لـ HomePage من غير أي navigate يدوي هنا
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
          <h1 className="text-2xl font-black mb-2" style={{ color: '#F4E2BC' }}>
            أهلاً بيك في ميسوري!
          </h1>
          <p className="text-sm" style={{ color: '#805D1B' }}>
            قبل ما نبدأ رحلتك في مصر القديمة، عايزين نعرفك أكتر
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-6"
          style={{ backgroundColor: '#FDF3E3', border: '1px solid rgba(200,146,42,0.25)' }}
        >
          {/* اختيار الشخصية */}
          <div className="mb-5">
            <label className="block font-bold text-sm mb-3" style={{ color: '#3D2B1F' }}>
              اختار شخصيتك
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {AVATARS.map((a) => {
                const isSelected = character === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setCharacter(a.id)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl press-effect no-tap-highlight"
                    style={{
                      backgroundColor: isSelected ? 'rgba(45,106,63,0.12)' : 'transparent',
                      border: `2px solid ${isSelected ? '#2D6A3F' : 'rgba(200,146,42,0.25)'}`,
                    }}
                  >
                    <AvatarDisplay avatarKey={a.id} size={48} />
                    <span
                      className="font-bold text-xs"
                      style={{ color: isSelected ? '#2D6A3F' : '#8B5A2B' }}
                    >
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* الاسم */}
          <div className="mb-4">
            <label className="block font-bold text-sm mb-2" style={{ color: '#3D2B1F' }}>
              اسمك
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد"
              maxLength={30}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(200,146,42,0.3)', color: '#3D2B1F' }}
            />
          </div>

          {/* العمر */}
          <div className="mb-5">
            <label className="block font-bold text-sm mb-2" style={{ color: '#3D2B1F' }}>
              عمرك
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="مثال: 10"
              min={5}
              max={100}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(200,146,42,0.3)', color: '#3D2B1F' }}
            />
          </div>

          {/* الجنس — منفصل تماماً عن اختيار الشخصية/الأفاتار فوق */}
          <div className="mb-5">
            <label className="block font-bold text-sm mb-2" style={{ color: '#3D2B1F' }}>
              الجنس
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[{ id: 'male', label: 'ذكر' }, { id: 'female', label: 'أنثى' }].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(g.id)}
                  className="py-3 rounded-xl font-bold text-sm press-effect no-tap-highlight"
                  style={{
                    backgroundColor: gender === g.id ? '#2D6A3F' : '#FFFFFF',
                    border: `1px solid ${gender === g.id ? '#2D6A3F' : 'rgba(200,146,42,0.3)'}`,
                    color: gender === g.id ? '#FFFFFF' : '#3D2B1F',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm font-semibold text-center mb-4" style={{ color: '#DC2626' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl font-bold text-white press-effect no-tap-highlight"
            style={{ backgroundColor: submitting ? '#A9793F' : '#C8922A', fontFamily: "'Cairo', sans-serif" }}
          >
            {submitting ? 'جاري الحفظ...' : 'ابدأ المغامرة 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default OnboardingPage;
