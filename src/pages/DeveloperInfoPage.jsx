/*
 * =====================================================
 * DeveloperInfoPage.jsx - عن المطوّر
 * =====================================================
 * تُفتح من قائمة الإعدادات (⚙️ → عن المطوّر). المحتوى أدناه
 * placeholder — عدّله ببياناتك الحقيقية (الاسم، رابط التواصل،
 * نبذة عن المشروع).
 * =====================================================
 */

import React from 'react';
import AppWrapper from '../components/layout/AppWrapper';
import Header      from '../components/layout/Header';
import BottomNav   from '../components/layout/BottomNav';

const CONTACT_EMAIL = 'omar.mahmoud.ahmed.01@gmail.com'; // ⬅️ بدّله ببريدك الحقيقي

function DeveloperInfoPage() {
  return (
    <AppWrapper>
      <Header showBack={true} />

      <main className="flex-1 px-6" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-3"></div>
          <h1 className="text-xl font-black" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
            عن ميسوري
          </h1>
        </div>

        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: '#FDF3E3', border: '1px solid rgba(200,146,42,0.25)' }}
        >
          <p className="text-sm leading-relaxed" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
            ميسوري تطبيق تعليمي تفاعلي لاكتشاف تاريخ وحضارة مصر القديمة بأسلوب ممتع، صُمم ليكون رفيق تعلّم شيّق لكل من يحب التاريخ المصري.
          </p>
        </div>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl press-effect no-tap-highlight mb-3"
          style={{ backgroundColor: 'white', border: '1px solid rgba(200,146,42,0.2)' }}
        >
          <i className="fi fi-rr-envelope" aria-hidden="true" style={{ fontSize: '16px', color: '#805D1B' }} />
          <span className="font-bold text-sm" style={{ fontFamily: "'Cairo', sans-serif", color: '#3D2B1F' }}>
            تواصل معنا
          </span>
        </a>

        <p className="text-center text-xs mt-4" style={{ fontFamily: "'Cairo', sans-serif", color: '#686462' }}>
          الإصدار 1.0
        </p>
      </main>

      <BottomNav activePage="home" />
    </AppWrapper>
  );
}

export default DeveloperInfoPage;
