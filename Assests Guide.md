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
│
├── public/                       ← ملفات ثابتة تُقرأ بمسار مباشر (لا تمر عبر Vite bundler)
│   └── assets/
│       ├── backgrounds/          ← 🖼️ خلفية التطبيق (لم تُضَف بعد)
│       └── icons/
│           ├── header/           ← 🖼️ أيقونات الهيدر (لم تُضَف بعد)
│           ├── nav/              ← 🖼️ أيقونات شريط التنقل السفلي (لم تُضَف بعد)
│           ├── levels/           ← 🖼️ أيقونات المستويات الخمسة (لم تُضَف بعد)
│           ├── badges/           ← 🖼️ أيقونات صغيرة مُعاد استخدامها (لم تُضَف بعد)
│           ├── stages/           ← 🖼️ أيقونات مراحل كل مستوى (لم تُضَف بعد)
│           ├── leaderboard/      ← 🖼️ أيقونات صفحة المتصدرين (لم تُضَف بعد)
│           ├── profile/          ← 🖼️ أيقونات صفحة معلوماتي (لم تُضَف بعد)
│           └── quiz-group/       ← 🖼️ أيقونات صفحة اختيار المرحلة (لم تُضَف بعد)
│
└── src/
    ├── main.jsx                  ← نقطة دخول React
    ├── App.jsx                   ← الجذر + Router البسيط
    ├── index.css                 ← الأنماط العامة
    │
    ├── context/
    │   └── AppContext.jsx        ← إدارة الحالة الكاملة
    │
    ├── data/                     ← بيانات وهمية (Mock Data)
    │   ├── levels.js             ← المستويات والمراحل (يحتوي مسارات أيقونات كل مستوى)
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
        │   ├── AppWrapper.jsx    ← حاوية التطبيق + خلفية التطبيق
        │   ├── Header.jsx        ← رأس الصفحة (رجوع / صوت / إعدادات)
        │   └── BottomNav.jsx     ← شريط التنقل
        │
        ├── home/                 ← مكوّنات الصفحة الرئيسية
        │   ├── HeroSection.jsx   ← قسم الترحيب (الشعار + الشخصية)
        │   ├── LevelsGrid.jsx    ← شبكة المستويات
        │   ├── LevelCard.jsx     ← بطاقة المستوى
        │   └── ProgressSection.jsx ← شريط التقدم
        │
        └── shared/               ← مكوّنات وصور مشتركة
            ├── EgyptianLogo.png       ✅ مُضافة
            ├── Character1_Pic.png     ✅ مُضافة (شخصية الولد)
            ├── Character2_Pic.png     ✅ مُضافة (شخصية البنت)
            └── ExplorerCharacter.jsx  ← يختار بين الصورتين حسب gender
```

---

## 🖼️ الصور المطلوب إضافتها (Assets To Add)

كل أيقونات التطبيق (الصفحة الرئيسية + معلوماتي + المتصدرين + اختيار المرحلة)
وخلفية التطبيق أصبحت في الكود عبارة عن عناصر `<img>` (أو `background-image`)
تشير إلى مسارات صور PNG **لم تُضَف بعد**.
هذا مقصود: كل الصفحات تعمل الآن بدون أخطاء (المساحات فارغة فقط)، وبمجرد ما تحط
كل صورة في مسارها **بالاسم نفسه بالظبط**، هتظهر تلقائياً من غير أي تعديل تاني في الكود.

كل المسارات تبدأ من مجلد `public/` (يعني `public/assets/icons/header/back-arrow.png`
يُستدعى في الكود كـ `/assets/icons/header/back-arrow.png`).

### 1) خلفية التطبيق

| الصورة | المسار الكامل | تُستخدم في | ملاحظات |
|---|---|---|---|
| خلفية التطبيق (أعمدة + عين حورس + هيروغليفية + مويجات + كثبان) | `public/assets/backgrounds/app-background.png` | `AppWrapper.jsx` | العرض المقترح ~900px (تُمدَّد تلقائياً بعرض الشاشة). الصورة تتكرر رأسياً (`repeat-y`) إذا كان المحتوى أطول من الصورة نفسها — فصمّمها بحيث تتكرر بسلاسة رأسياً إذا حبيت تغطية كاملة للصفحة الطويلة |

### 2) أيقونات الهيدر (أعلى الصفحة)

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| سهم الرجوع | `public/assets/icons/header/back-arrow.png` | `Header.jsx` | 22×22px |
| صوت مفعّل | `public/assets/icons/header/sound-on.png` | `Header.jsx` | 22×22px |
| صوت مكتوم | `public/assets/icons/header/sound-off.png` | `Header.jsx` | 22×22px |
| الإعدادات | `public/assets/icons/header/settings.png` | `Header.jsx` | 22×22px |

### 3) أيقونات شريط التنقل السفلي

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| معلومات (i) | `public/assets/icons/nav/info.png` | `BottomNav.jsx` | 22×22px، أبيض/فاتح (توضع فوق دائرة فيروزية) |
| الرئيسية (بيت) | `public/assets/icons/nav/home.png` | `BottomNav.jsx` | 22×22px، أبيض/فاتح (توضع فوق دائرة بنية) |
| المتصدرين (كوب) | `public/assets/icons/nav/leaderboard.png` | `BottomNav.jsx` | 22×22px، أبيض/فاتح (توضع فوق دائرة ذهبية) |

### 4) أيقونات بطاقات المستويات

| الصورة | المسار الكامل | المستوى | المقاس المقترح |
|---|---|---|---|
| هرم | `public/assets/icons/levels/level-1-pyramid.png` | Level 1 - سهل | 36×36px |
| قناع فرعون ذهبي | `public/assets/icons/levels/level-2-pharaoh-mask.png` | Level 2 - متوسط | 36×36px |
| عمود فرعوني | `public/assets/icons/levels/level-3-pillar.png` | Level 3 - صعب | 36×36px |
| تمثال فرعون | `public/assets/icons/levels/level-4-pharaoh-figure.png` | Level 4 - صعب جداً | 36×36px |
| درع وعنخ | `public/assets/icons/levels/level-5-ankh-shield.png` | Level 5 - متقدم | 36×36px |

مسارات هذه الأيقونات معرَّفة مركزياً في `src/data/levels.js` (حقل `iconSrc` لكل مستوى)،
مش مكتوبة مباشرة داخل `LevelCard.jsx` — يعني لو غيّرت الاسم أو المسار، عدّل هناك بس.

### 5) أيقونات صغيرة مُعاد استخدامها (Badges)

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| شخص (لعدد الاختبارات) | `public/assets/icons/badges/quiz-count.png` | `LevelCard.jsx` (كل البطاقات) | 11×11px، أبيض (توضع فوق دائرة صغيرة بلون المستوى) |
| نجمة (للنقاط الممكنة) | `public/assets/icons/badges/points-star.png` | `LevelCard.jsx` (كل البطاقات) | 11×11px، أبيض |
| قفل | `public/assets/icons/badges/lock.png` | `LevelCard.jsx` (المستويات المقفولة فقط) | 14×14px، أبيض |

> ℹ️ هذه الثلاثة مشتركة بين كل البطاقات (نفس الصورة تتكرر)، بعكس أيقونات المستويات
> اللي كل مستوى له صورة مختلفة.

### 6) أيقونات مراحل المستوى (صفحة اختيار المرحلة)

| الصورة | المسار الكامل | المرحلة | المقاس المقترح |
|---|---|---|---|
| البدايات | `public/assets/icons/stages/stage-1-beginnings.png` | المستوى 1 / المرحلة 1 | 32×32px |
| الحضارة | `public/assets/icons/stages/stage-2-civilization.png` | المستوى 1 / المرحلة 2 | 32×32px |
| المعابد | `public/assets/icons/stages/stage-3-temples.png` | المستوى 1 / المرحلة 3 | 32×32px |
| الفراعنة | `public/assets/icons/stages/stage-4-pharaohs.png` | المستوى 1 / المرحلة 4 | 32×32px |
| النيل والحياة | `public/assets/icons/stages/stage-5-nile.png` | المستوى 1 / المرحلة 5 | 32×32px |

> ℹ️ حالياً مراحل المستويات 2-5 لسه فاضية في `levels.js` (`stages: []`) — لما تُبنى
> لاحقاً، أضف لكل مرحلة حقل `imageSrc` بنفس الطريقة.

### 7) أيقونات صفحة اختيار المرحلة (QuizGroupPage)

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| نقاط | `public/assets/icons/quiz-group/points.png` | شارة "نقطة ممكنة" أعلى الصفحة | 18×18px، أبيض |
| اختبارات | `public/assets/icons/quiz-group/quizzes.png` | شارة "اختبارات" أعلى الصفحة | 18×18px، أبيض |
| سهم البدء | `public/assets/icons/quiz-group/start-arrow.png` | زر "ابدأ" على كل مرحلة مفتوحة | 14×14px، أبيض |
| قفل (كبير) | `public/assets/icons/quiz-group/lock-large.png` | داخل مربع صورة المرحلة المقفولة | 32×32px |
| قفل (صغير) | `public/assets/icons/quiz-group/lock-small.png` | زر المرحلة المقفولة (يمين الصف) | 20×20px |

### 8) أيقونات صفحة المتصدرين (LeaderboardPage)

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| كوب ذهبي | `public/assets/icons/leaderboard/trophy-gold.png` | المركز الأول | 28×28px |
| كوب فضي | `public/assets/icons/leaderboard/trophy-silver.png` | المركز الثاني | 28×28px |
| كوب برونزي | `public/assets/icons/leaderboard/trophy-bronze.png` | المركز الثالث | 28×28px |

> ℹ️ الصورة الرمزية بجانب اسم كل لاعب **مش محتاجة صورة جديدة** —
> بقت تستخدم نفس `Character1_Pic.png` / `Character2_Pic.png` الموجودين بالفعل،
> مقصوصة دائرياً (crop) حسب `player.avatar`. لو عايز صور مختلفة تماماً لهذا
> الاستخدام تحديداً، قولّي عشان أفصلها في مسار خاص بيها.

### 9) أيقونات صفحة معلوماتي (ProfilePage)

| الصورة | المسار الكامل | تُستخدم في | المقاس المقترح |
|---|---|---|---|
| قلم التعديل | `public/assets/icons/profile/edit-pencil.png` | زر تعديل كل حقل بيانات | 14×14px |
| حقل الاسم | `public/assets/icons/profile/field-name.png` | بجانب "الاسم" | 16×16px |
| حقل العمر | `public/assets/icons/profile/field-age.png` | بجانب "العمر" | 16×16px |
| حقل الدولة | `public/assets/icons/profile/field-country.png` | بجانب "الدولة" | 16×16px |
| حقل البريد | `public/assets/icons/profile/field-email.png` | بجانب "البريد" | 16×16px |
| أيقونة اختيار الشخصية | `public/assets/icons/profile/character-select.png` | عنوان قسم "الشخصية" | 28×28px |
| علامة الاختيار | `public/assets/icons/profile/checkmark.png` | فوق الشخصية المُختارة | 12×12px، أبيض |
| أيقونة البيانات الشخصية | `public/assets/icons/profile/personal-data.png` | عنوان قسم "البيانات الشخصية" | 24×24px |
| أيقونة الإحصائيات | `public/assets/icons/profile/stats-icon.png` | عنوان قسم "إحصائياتي" | 22×22px |
| إحصائية النقاط | `public/assets/icons/profile/stat-points.png` | بطاقة "إجمالي النقاط" | 24×24px |
| إحصائية الترتيب | `public/assets/icons/profile/stat-rank.png` | بطاقة "الترتيب الحالي" | 24×24px |
| إحصائية المراحل | `public/assets/icons/profile/stat-stages.png` | بطاقة "المراحل المكتملة" | 24×24px |
| إحصائية المستوى | `public/assets/icons/profile/stat-level.png` | بطاقة "المستوى الحالي" | 24×24px |

> ℹ️ ملاحظة: أيقونة حقل "الاسم" كانت 🟢 (دائرة خضراء) في النسخة القديمة، وده
> مش دلالة واضحة على "اسم" — لو حابب أقترح أيقونة شخص/مستخدم بدلها وقت التصميم قولّي.

### ✅ صور مُضافة بالفعل (لا تحتاج شيء)

| الصورة | المسار | تُستخدم في |
|---|---|---|
| الشعار (Mesori) | `src/components/shared/EgyptianLogo.png` | كل الصفحات (الهيدر) |
| شخصية المستكشف (ولد) | `src/components/shared/Character1_Pic.png` | `ExplorerCharacter` + صورة رمزية مقصوصة في المتصدرين |
| شخصية المستكشفة (بنت) | `src/components/shared/Character2_Pic.png` | `ExplorerCharacter` + صورة رمزية مقصوصة في المتصدرين |

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

المحتوى يتمدد طبيعياً بالطول ويصبح قابلاً للتمرير (scroll) لو زاد عن ارتفاع
الشاشة — مفيش تحجيم إجباري لضغط كل حاجة داخل شاشة واحدة، ده طبيعي وسليم
لتطبيق موبايل.

---

## 🔮 الخطوات القادمة

- [ ] إضافة صور PNG الفعلية بدل الأماكن الفارغة (راجع قسم "الصور المطلوب إضافتها" أعلاه)
- [x] بناء صفحة الاختبار (QuizPage)
- [ ] إضافة الأسئلة الحقيقية في ملفات JSON
- [ ] نظام النقاط والمكافآت
- [ ] الترحيل إلى Next.js + Supabase
