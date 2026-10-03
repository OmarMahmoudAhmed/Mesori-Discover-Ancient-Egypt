# 🏺 ميسوري - Mesori
## اكتشف تاريخ مصر القديمة

تطبيق تعليمي تفاعلي (Gamified) يساعد الأطفال والشباب على اكتشاف الحضارة المصرية القديمة.

---

## 🚀 تشغيل المشروع

```bash
# 1. تثبيت الحزم (مرة واحدة فقط)
npm install

# 2. تشغيل وضع التطوير
npm run dev

# 3. افتح المتصفح على:
# http://localhost:5173
```

---

## 🗂️ هيكل الملفات

```
mesori-app/
├── index.html                    ← نقطة دخول HTML
├── vite.config.js                ← إعداد Vite
├── tailwind.config.js            ← ألوان وإعدادات Tailwind
├── postcss.config.js             ← معالج CSS
└── src/
    ├── main.jsx                  ← نقطة دخول React
    ├── App.jsx                   ← الجذر + Router البسيط
    ├── index.css                 ← الأنماط العامة
    │
    ├── context/
    │   └── AppContext.jsx        ← إدارة الحالة الكاملة
    │
    ├── data/                     ← بيانات وهمية (Mock Data)
    │   ├── levels.js             ← المستويات والمراحل
    │   ├── quizzes.js            ← أسئلة الاختبارات (مرحلة 1-1 فقط حالياً)
    │   ├── leaderboard.js        ← قائمة المتصدرين
    │   └── userProfile.js        ← بيانات المستخدم
    │
    ├── pages/                    ← الصفحات الرئيسية
    │   ├── HomePage.jsx          ✅ مُنفَّذة بالكامل
    │   ├── QuizGroupPage.jsx     ✅ مُنفَّذة
    │   ├── QuizPage.jsx          ✅ مُنفَّذة (أسئلة + نتيجة + نقاط)
    │   ├── LeaderboardPage.jsx   ✅ مُنفَّذة
    │   └── ProfilePage.jsx       ✅ مُنفَّذة
    │
    └── components/
        ├── layout/               ← مكوّنات الهيكل
        │   ├── AppWrapper.jsx    ← حاوية التطبيق
        │   ├── Header.jsx        ← رأس الصفحة
        │   └── BottomNav.jsx     ← شريط التنقل
        │
        ├── home/                 ← مكوّنات الصفحة الرئيسية
        │   ├── HeroSection.jsx   ← قسم الترحيب
        │   ├── LevelsGrid.jsx    ← شبكة المستويات
        │   ├── LevelCard.jsx     ← بطاقة المستوى
        │   └── ProgressSection.jsx ← شريط التقدم
        │
        └── shared/               ← مكوّنات مشتركة
            ├── EgyptianLogo.jsx  ← الشعار الفرعوني (SVG)
            └── ExplorerCharacter.jsx ← شخصية المستكشف (SVG)
```

---

## 🛠️ التقنيات المستخدمة

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| React   | 18.x    | بناء الواجهة |
| Vite    | 5.x     | أداة البناء |
| Tailwind CSS | 3.x | التنسيق |
| React Context API | - | إدارة الحالة |

---

## 📱 تصميم موبايل أولاً

التطبيق مُصمَّم للموبايل (max-width: 448px).
على الشاشات الكبيرة، يظهر كشاشة هاتف في منتصف الشاشة.

---

## 🔮 الخطوات القادمة

- [x] بناء صفحة الاختبار (QuizPage)
- [ ] إضافة الأسئلة الحقيقية في ملفات JSON
- [ ] نظام النقاط والمكافآت
- [ ] الترحيل إلى Next.js + Supabase
