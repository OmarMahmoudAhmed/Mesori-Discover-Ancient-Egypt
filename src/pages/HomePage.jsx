/*
 * =====================================================
 * HomePage.jsx - الصفحة الرئيسية للتطبيق
 * =====================================================
 *
 * ┌─────────────────────────────────────────────────┐
 * │  AppWrapper (حاوية التطبيق الكاملة)             │
 * │  ┌───────────────────────────────────────────┐  │
 * │  │  Header (🔔 إشعارات | ⚔️ 1ضد1 | ⚙️ إعدادات) │  │
 * │  ├───────────────────────────────────────────┤  │
 * │  │  main (flex-col يملأ المساحة المتبقية)     │  │
 * │  │  ├── HeroSection  (تصميم جديد، ثابت الحجم) │  │
 * │  │  └── LevelsGrid   (تصميم جديد، ثابت الحجم) │  │
 * │  ├───────────────────────────────────────────┤  │
 * │  │  BottomNav (INFO | 🏠 | LEADERBOARD)      │  │
 * │  └───────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────┘
 *
 * ⬅️ تمت إزالة ProgressSection (شريط التقدم السفلي) بالكامل بناءً
 *   على طلب إعادة التصميم. HeroSection وLevelsGrid بقوا الاثنين
 *   flex-shrink-0 بحجمهم الطبيعي (مش flex-1) عشان كروت المستويات
 *   الجديدة (مستطيلة وأكبر من قبل) تاخد المساحة اللي تحتاجها من
 *   غير ما تتقهقر/تتشوّه.
 * ⬅️ overflow-y-auto فاضل على main كـ"شبكة أمان" — لو المحتوى على
 *   شاشة قصيرة جداً زاد شوية عن الارتفاع المتاح، هيعمل سكرول خفيف
 *   بدل ما يقصّ جزء من كرت كامل. في الاستخدام العادي على أي هاتف
 *   حديث الصفحة هتتظبط في الشاشة من غير تمرير.
 * =====================================================
 */

import React from 'react';

/* --- استيراد مكوّنات الهيكل (Layout) --- */
import AppWrapper from '../components/layout/AppWrapper';
import Header     from '../components/layout/Header';
import BottomNav  from '../components/layout/BottomNav';

/* --- استيراد مكوّنات الصفحة الرئيسية --- */
import HeroSection     from '../components/home/HeroSection';
import LevelsGrid      from '../components/home/LevelsGrid';

function HomePage() {
  return (
    <AppWrapper>

      <Header showNotifications={true} showVsIcon={true} />

      <main
        className="flex-1 min-h-0 overflow-y-auto app-scroll flex flex-col"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <HeroSection />
        <LevelsGrid />
      </main>

      <BottomNav activePage="home" />

    </AppWrapper>
  );
}

export default HomePage;
