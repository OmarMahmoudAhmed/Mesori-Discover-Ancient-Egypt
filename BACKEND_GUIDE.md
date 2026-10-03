# دليل الانتقال لـ Backend و Database — مشروع Mesori

دليل شامل مكتوب خصيصاً لمشروعك، من واحد بيعرف Frontend كويس لكن أول مرة يدخل عالم الـ backend وقواعد البيانات. الهدف إنك تفهم *ليه* قبل ما تنفّذ، وكل خطوة عملية متقسمة كمهمة جاهزة تقدر تديها لـ Claude (chat جديد أو Claude Code) وتاخد نتيجة تقدر تراجعها.

**إزاي تستخدم الدليل:** اقرأ "الصورة الكبيرة" و"المفاهيم الأساسية" مرة واحدة كويس (مش هتحتاج تكررهم). بعدين اشتغل بالمراحل بالترتيب — كل مرحلة مبنية على اللي قبلها. لما توصل لمهمة، انسخ الـ prompt الجاهز، حطه في chat جديد مع Claude (اربطله ملفات مشروعك المطلوبة أو ارفق هذا الدليل نفسه)، وراجع الناتج قبل ما تدمجه.

---

## 📑 المحتويات

1. [الصورة الكبيرة](#big-picture)
2. [المفاهيم الأساسية](#concepts)
3. [تصميم قاعدة البيانات](#schema)
4. [خطة المراحل](#roadmap)
5. [المرحلة 1: القاعدة والجداول](#phase-1)
6. [المرحلة 2: القراءة فقط (Read-only)](#phase-2)
7. [المرحلة 3: تسجيل الدخول](#phase-3)
8. [المرحلة 4: تقدّم ونقاط حقيقية](#phase-4)
9. [المرحلة 5: لاحقاً — Next.js](#phase-5)
10. [حاجات تستاهل تفكّر فيها](#later)

---

<a name="big-picture"></a>
## 1. الصورة الكبيرة

دلوقتي Mesori كله شغال جوه المتصفح بس: `levels.js` و`quizzes.js` بيانات مكتوبة يدوياً جوه الكود، و`AppContext.jsx` بيحتفظ بحالة المستخدم (النقاط، الشخصية) في React state. ده معناه:

- أي حد بيفتح المشروع بيشوف نفس الأسئلة بالظبط
- تعمل refresh للصفحة → كل التقدم والنقاط بتضيع
- مفيش مفهوم "مستخدم حقيقي" أصلاً — `userProfile.js` كائن وهمي واحد ثابت

الهدف من الـ backend إنك تحل الثلاث نقط دي: بيانات دائمة (مش بتضيع)، مستخدمين حقيقيين (كل طفل له حسابه وتقدمه)، ومصدر بيانات تقدر تعدّله من غير ما تعمل deploy لكود جديد.

```mermaid
flowchart LR
    A[مكوّنات React] --> B[AppContext.jsx]
    B --> C["src/data/*.js<br/>بيانات ثابتة مكتوبة داخل الكود"]
    style C fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
```

```mermaid
flowchart LR
    A2[مكوّنات React] --> B2[AppContext.jsx]
    B2 --> C2[Supabase Client]
    C2 --> D2[("قاعدة بيانات<br/>Postgres")]
    C2 --> E2[Supabase Auth]
    style D2 fill:#dcfce7,stroke:#16a34a,color:#14532d
    style E2 fill:#dcfce7,stroke:#16a34a,color:#14532d
```

الخبر الحلو: كودك الحالي مجهّز لده فعلاً. لو رجعت لتعليقات `AppContext.jsx` و`levels.js` و`leaderboard.js` هتلاقي فيها بالحرف استعلامات Supabase المكافئة — يبقى مش هتبني حاجة من الصفر، هتوصّل حاجة موجودة بالفعل.

---

<a name="concepts"></a>
## 2. المفاهيم الأساسية

مش هشرحلك كل تفصيلة (إنت مبرمج أصلاً)، بس الحاجات المختلفة فعلاً عن تفكير الـ frontend:

**Backend إيه بالظبط؟**
كود الـ frontend شغال في متصفح المستخدم — أي حد يقدر يفتح DevTools ويشوفه ويعدّله. الـ backend شغال على سيرفر إنت المتحكم فيه، وهو المكان الوحيد اللي تقدر تثق فيه لحاجات زي "النقطة الحقيقية للمستخدم ده" أو "هل الإجابة دي صح فعلاً".

**قاعدة البيانات (Database)؟**
مكان لتخزين بيانات دائمة عبر الأجهزة والجلسات، عكس React state اللي بيتصفّر مع أي refresh. Postgres (اللي Supabase مبني عليه) هو نوع "علائقي" (relational): بياناتك في جداول (tables)، كل جدول صفوف وأعمدة، والجداول تقدر "تشاور" على بعض (foreign keys).

**Supabase تحديداً إيه؟**
مش قاعدة بيانات بس — حزمة كاملة: قاعدة Postgres مُستضافة + API جاهز تتكلم بيه من الـ frontend مباشرة (من غير ما تكتب backend server بنفسك) + نظام تسجيل دخول (Auth) + نظام صلاحيات على مستوى الصف (RLS، الفقرة الجاية) + تخزين ملفات. عشان كده مناسب لمشروع فردي زي ده — بيوفّرلك بناء backend كامل من الصفر.

**Row Level Security (RLS) — المفهوم الأهم في Supabase**
لأن المتصفح بيتكلم مع قاعدة البيانات شبه مباشر (مش زي backend تقليدي فيه كود سيرفر بيفلتر كل حاجة)، لازم قاعدة البيانات *نفسها* تفرض القواعد. RLS = سياسات بتكتبها بلغة SQL، وPostgres بيطبّقها تلقائياً على أي استعلام، أياً كان مين اللي بيسأل. مثال: "المستخدم يقدر يقرأ سجل تقدمه هو بس، مش سجل أي حد تاني".

**مبدأ "متثقش في العميل" (Never trust the client)**
ده أهم درس هتتعلمه من المشروع ده. أي رقم أو قيمة جاية من المتصفح (زي "جاوبت 8 من 10 صح") ممكن أي حد يعدّلها من DevTools قبل ما توصلك — خصوصاً في تطبيق أطفال، هيبقى فيه طفل شاطر بيجرّب. الحل: النقاط والدرجة تتحسب *جوه قاعدة البيانات نفسها*، مش تتبعت جاهزة من المتصفح. هنطبّق ده عملياً في [المرحلة 4](#phase-4).

**متغيرات البيئة (.env) والمفاتيح**
Supabase بيدّيك مفتاحين مختلفين تماماً: الـ **anon key** (public) مصمّم يتحط في كود الـ frontend وينُشر معاه — الأمان مش منه هو، الأمان من RLS. الـ **service_role key** بالعكس، سر كامل، لو اتسرّب أي حد يقدر يقرا/يعدّل قاعدة بياناتك كلها من غير أي RLS. متحطّهوش في كود React أبداً، بس في سكريبتات تشتغل عندك محلياً (زي سكريبت الترحيل في المرحلة 1).

---

<a name="schema"></a>
## 3. تصميم قاعدة البيانات

> **⚠️ تحديث (بعد التطبيق الفعلي):** النسخة الأولى من هذا المخطط كانت
> تفترض `id` مفتاحاً أساسياً منفرداً لـ `stages` و`questions`. لكن
> `id` في بيانات الواجهة (`data/levels.js` و`data/quizzes.js`) محلي
> ومتعمّد التكرار (كل مستوى فيه مراحل 1-5، وكل مرحلة فيها أسئلة 1-10) —
> فلما تحوّل لمفتاح عالمي في القاعدة، كل `upsert` لمستوى/مرحلة جديدة
> كان يستبدل (يمحو بصمت) بيانات المستوى/المرحلة اللي قبلها بنفس الرقم.
> النتيجة الفعلية كانت 5 صفوف بس في `stages` (مستوى واحد) و10 صفوف
> بس في `questions` (مرحلة واحدة) بدل 25 و250! المخطط تحته مُصحح
> بمفاتيح مركّبة تحل المشكلة دي من الأساس — لو بتطبّق من الصفر، استخدم
> النسخة دي مباشرة (`supabase/migrations/001_schema.sql`).

```mermaid
erDiagram
    profiles ||--o{ user_progress : "له"
    levels ||--o{ stages : "يحتوي"
    stages ||--o{ questions : "يحتوي"
    stages ||--o{ user_progress : "مرتبط بيه"

    profiles {
        uuid id PK
        text username
        text character
        int age
        text country
        text country_flag
        int total_points
    }
    levels {
        int id PK
        text name_ar
        text name_en
        text difficulty
        int max_points
    }
    stages {
        int id "PK مركّب مع level_id"
        int level_id FK "PK مركّب مع id"
        text title
        text description
        text emoji
        int order_index
    }
    questions {
        int id "PK مركّب مع level_id+stage_id"
        int level_id "PK مركّب + FK مركّب مع stages"
        int stage_id "PK مركّب + FK مركّب مع stages"
        text question
        jsonb options
        int correct_index
        text explanation
    }
    user_progress {
        uuid user_id FK
        int level_id "FK مركّب مع stages"
        int stage_id "FK مركّب مع stages"
        bool is_completed
        int best_score
    }
```

**قرار تستاهل تاخده بنفسك:** حطيت `levels`/`stages` كجداول كاملة عشان `questions.stage_id` محتاج حاجة يشاور عليها، وتتبّع التقدم محتاج هوية ثابتة للمرحلة. لكن الحقول البصرية البحتة (الألوان، مسارات الأيقونات) فضلت في الكود (`AppContext.jsx` → `LEVEL_PRESENTATION`) بدل قاعدة البيانات — مش هتفرق كتير أداءً، والفرق إنك لو حبيت تغيّر لون مستوى من غير deploy، هتحتاجه في القاعدة بدل الكود. أما `description`/`emoji` الخاصة بكل *مرحلة* (مش المستوى) و`explanation` لكل سؤال فهي محتوى تعليمي حقيقي يظهر في الواجهة، فلازم تكون في القاعدة دايماً — ده بالظبط اللي كان ناقصاً وسبب الأخطاء الأولى.

**قرار تصميم مهم: مفيش جدول `leaderboard` منفصل.** المتصدرين هم ببساطة `profiles` مرتّبة تنازلياً حسب `total_points`. لو عملت جدول منفصل هيحتاج يفضل متزامن مع `profiles` يدوياً، وده مصدر أخطاء مش محتاجه.

**تنبيه أمان بسيط تعرفه:** لو خليت `questions` قابلة للقراءة العامة (زي ما هتعمل في [المرحلة 2](#phase-2))، أي حد فاتح DevTools هيقدر يشوف `correct_index` قبل ما يجاوب. مش خطير لتطبيق تعليمي شخصي، بس لو حبيت تقفلها تماماً لاحقاً، الحل موجود في [آخر قسم](#later).

**تنبيه GRANT (مختلف عن RLS):** فعّلت RLS مش كفاية لوحدها — PostgREST محتاج GRANT فعلي على مستوى الجدول نفسه للدور (`anon`/`authenticated`) *بالإضافة* لسياسة RLS المسموحة، وإلا هتاخد 401 حتى لو الـ policy بتقول `USING (true)`. راجع `GRANT SELECT ON levels, stages, questions TO anon, authenticated;` في نهاية ملف الـ migration.

---

<a name="roadmap"></a>
## 4. خطة المراحل

```mermaid
flowchart TD
    P1["المرحلة 1<br/>القاعدة والجداول"] --> P2["المرحلة 2<br/>قراءة فقط"]
    P2 --> P3["المرحلة 3<br/>تسجيل الدخول"]
    P3 --> P4["المرحلة 4<br/>تقدّم ونقاط حقيقية"]
    P4 -.لاحقاً.-> P5["المرحلة 5<br/>Next.js"]
```

كل مرحلة مبنية على اللي قبلها، وكل مرحلة بتنتهي بتطبيق شغال تقدر تجربه فعلياً — مش هتفضل بمرحلة نص مكسورة لفترة طويلة.

---

<a name="phase-1"></a>
## 5. المرحلة 1: القاعدة والجداول

**هتعمله بنفسك (يدوي، دقيقتين):**
1. سجّل في [supabase.com](https://supabase.com)، اعمل مشروع جديد
2. من Project Settings → API، خد الـ `Project URL` والـ `anon public key`

### المهمة 1.1 — بناء الجداول وترحيل البيانات الحالية

**ليه:** عايز الجداول من قسم "تصميم قاعدة البيانات" فعلياً موجودة في Supabase، وعايز الأسئلة العشرة اللي كتبناها في `quizzes.js` تبقى صفوف حقيقية بدل ما تتكتب مرتين.

**البرومبت الجاهز:**
```
بشتغل على مشروع Mesori (React + Vite، تطبيق تعليمي عن مصر القديمة).
عندي مشروع Supabase جاهز. عايزك:

1. تكتب SQL migration file فيه الجداول: profiles, levels, stages,
   questions, user_progress — بالشكل ده بالظبط:
   [الصق قسم "تصميم قاعدة البيانات" من BACKEND_GUIDE.md هنا]

2. تضيف RLS policies:
   - قراءة عامة (حتى لغير المسجلين) لـ levels وstages وquestions
   - كل مستخدم يقرأ/يعدّل صفه هو بس في profiles وuser_progress

3. تكتب سكريبت Node.js بسيط (@supabase/supabase-js + service_role key محلي
   في .env، مش هيتحط في كود React) بيقرأ الملفات دي ويرفع بياناتها للجداول:
   [الصق محتوى src/data/levels.js و src/data/quizzes.js هنا]

اشرحلي كل جزء وانت بتكتبه، وقولي بالظبط ال commands اللي أشغّلها.
```

**هتتأكد إنها اشتغلت لما:** تفتح Table Editor في Supabase وتلاقي **250 صف بالظبط** في جدول `questions` (مش أقل) و**25 صف** في `stages` — لو العدد أقل من المتوقع رغم إن السكريبت قال "تم بنجاح"، غالباً فيه تضارب صامت في مفتاح أساسي (upsert بيستبدل صفوف بدل ما يضيفها)، زي ما حصل بالظبط أول مرة.

---

<a name="phase-2"></a>
## 6. المرحلة 2: القراءة فقط (Read-only)

الهدف هنا إثبات إن الاتصال شغال بأبسط شكل ممكن (بيانات عامة، بدون تعقيد تسجيل الدخول) قبل ما تضيف طبقة الـ Auth.

### المهمة 2.1 — توصيل الواجهة بـ Supabase

**ليه:** تستبدل الاستيراد المباشر لـ `levelsData`/`quizzesData` باستعلامات حقيقية، من غير ما تلمس أي مكوّن React تاني.

**البرومبت الجاهز:**
```
مشروع Mesori (React + Vite) عنده src/data/levels.js وsrc/data/quizzes.js
بيتم استيرادهم مباشرة بـ import. عندي دلوقتي Supabase فيه جداول levels/
stages/questions بنفس البنية دي: [الصق قسم "تصميم قاعدة البيانات"].

عايزك:
1. تركّب @supabase/supabase-js
2. تعمل src/lib/supabaseClient.js، والمفاتيح تيجي من .env
   (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. تستبدل levelsData وquizzesData باستعلامات Supabase، مع الحفاظ التام
   على نفس شكل البيانات اللي المكوّنات دي بتتوقعه:
   [الصق src/pages/QuizGroupPage.jsx و src/pages/QuizPage.jsx]
   عشان محتاجش أعدّل أي كومبوننت
4. ضيف حالة تحميل (loading) بسيطة تتماشى مع تصميم التطبيق (فونت Cairo،
   الألوان الموجودة بالفعل في tailwind.config.js)

هبعتلك أي ملف تاني تحتاجه.
```

**هتتأكد إنها اشتغلت لما:** تشغّل `npm run dev`، والمراحل والأسئلة تظهر زي الأول بالظبط — بس دلوقتي جاية من قاعدة بيانات حقيقية (جرّب تعدّل نص سؤال من Table Editor وشوفه بيتغيّر في التطبيق من غير ما تلمس كود).

---

<a name="phase-3"></a>
## 7. المرحلة 3: تسجيل الدخول ✅ (منفّذة)

**قرار اتاخد:** إيميل+باسورد (أبسط حاجة). لو خططت لاستخدام حقيقي مع أطفال طلابك مش بس للتجربة الشخصية، راجع الأول أي قواعد محلية أو دولية لحماية بيانات القاصرين (زي COPPA في أمريكا) قبل ما تجمع أي بيانات حقيقية منهم — ده موضوع قانوني مش تقني، وأنا مش المصدر المناسب لاستشارة قانونية فيه، بس يستاهل تتأكد منه بدري قبل أي إطلاق فعلي.

### ما تم تنفيذه فعلياً

- **`mesori-auth/`**: تصميم شاشة الدخول/التسجيل (منقول الآن لـ `src/pages/LoginPage.jsx` و`src/components/auth/`)، مربوط بـ `supabase.auth.signInWithPassword` / `supabase.auth.signUp` عبر `signIn`/`signUp` في `AppContext.jsx`.
- **`supabase/migrations/002_auth_and_leaderboard.sql`**:
  - `profiles.onboarding_completed` — لتتبّع هل المستخدم اختار اسمه/عمره/شخصيته.
  - Trigger `on_auth_user_created` (SECURITY DEFINER): بمجرد تسجيل حساب جديد في `auth.users`، يتولّد صف تلقائي في `profiles` — لا حاجة لـ INSERT يدوي من الواجهة.
  - View `public.leaderboard`: قائمة متصدرين حقيقية (id، username، character، total_points، level_reached، rank) من `profiles` مع `LEFT JOIN user_progress`، تعمل "تخطّي" لـ RLS الصارم على `profiles` عمداً (راجع تعليق الملف نفسه لشرح آلية Postgres وراء ده) بدون كشف أعمدة حسّاسة زي `age`/`country`.
- **`src/pages/OnboardingPage.jsx`**: شاشة تظهر مرة واحدة بعد أول تسجيل (طالما `!userProfile.onboardingCompleted`)، تختار الاسم/العمر/الشخصية، وتحفظهم عبر `completeOnboarding()`.
- **`src/App.jsx`**: بوابة كاملة — `authLoading` → `!session` (LoginPage) → `profileLoading` → `!onboardingCompleted` (OnboardingPage) → التطبيق المعتاد.
- **`src/pages/LeaderboardPage.jsx`**: بيقرأ من الـ view الحقيقي بدل `data/leaderboard.js` الثابت (اتحذف).

**هتتأكد إنها اشتغلت لما:** تسجّل حساب جديد، تكمّل Onboarding، تقفل التاب، تفتحه تاني — لسه مسجّل دخول ومش هيطلب Onboarding تاني، وتلاقي صف جديد ليك في `profiles` وظاهر في `leaderboard` بعد أول نقطة.

---

<a name="phase-4"></a>
## 8. المرحلة 4: تقدّم ونقاط حقيقية

⚠️ **تحديث:** جزء من هذه المرحلة اتنفّذ فعلاً بشكل مبسّط ضمن مهمة المرحلة 3 (كانت الاثنتان مطلوبتان معاً في نفس الجلسة) — دالة `record_stage_progress(p_level_id, p_stage_id, p_score)` في نفس ملف `002_auth_and_leaderboard.sql` بتحدّث `user_progress` و`profiles.total_points` معاً بشكل ذرّي (transaction واحدة)، وبتستخدم `auth.uid()` من الجلسة نفسها (مش user_id جاي من العميل). **الناقص لسه:** التحقق من إن `correct_count`/النقاط المُرسَلة منطقية فعلاً بمقارنتها بعدد أسئلة المرحلة الحقيقي — دلوقتي الدالة بتثق في الرقم اللي بيوصلها من `completeStage()` في `AppContext.jsx`. المهمة 4.1 تحت لسه صالحة لإضافة هذا التحقق تحديداً:

هنا بيتطبّق مبدأ "متثقش في العميل" اللي شرحناه فوق. بدل ما `QuizPage.jsx` يبعت "جاوبت 8 صح" ونصدّقه، بنبعت *عدد الإجابات الصح بس*، وقاعدة البيانات نفسها بتتأكد وتحسب النقاط:

```mermaid
sequenceDiagram
    participant U as المستخدم (المتصفح)
    participant DB as Supabase (RPC Function)

    U->>DB: claim_stage_completion(level_id: 1, stage_id: 1, correct_count: 8)
    Note over DB: يتأكد إن عدد أسئلة المرحلة فعلاً = 10
    Note over DB: يحسب النقاط بنفسه (مش بيصدّق رقم جاهز)
    DB->>DB: يحدّث user_progress
    DB->>DB: يحدّث profiles.total_points
    DB-->>U: { success: true, points_earned: 16 }
```

### المهمة 4.1 — تحقّق من صحة النقاط داخل RPC (تقوية record_stage_progress الموجودة)

**البرومبت الجاهز:**
```
مشروع Mesori. عندي دالة record_stage_progress(p_level_id, p_stage_id, p_score)
في supabase/migrations/002_auth_and_leaderboard.sql بتحدّث user_progress
وprofiles.total_points، لكنها بتثق في p_score من غير أي تحقّق. عايزك:

1. تعدّل الدالة عشان تتأكد إن p_score منطقي فعلاً: تجيب عدد أسئلة
   المرحلة الحقيقي من جدول questions (WHERE level_id=p_level_id AND
   stage_id=p_stage_id)، تحسب أقصى نقاط ممكنة بنفس معادلة AppContext.jsx
   (maxPoints ÷ عدد المراحل ÷ عدد الأسئلة × عدد الأسئلة)، وترفض أي
   p_score أكبر من الحد الأقصى المحسوب (RAISE EXCEPTION)
2. مفيش تغيير مطلوب في AppContext.jsx — بيستدعي نفس الدالة بنفس الاسم
   والمعاملات أصلاً

اشرحلي ليه التحقّق ده مهم حتى لو الواجهة الحالية بتحسب صح.
```

**هتتأكد إنها اشتغلت لما:** تفتح Console وتستدعي `supabase.rpc('record_stage_progress', {p_level_id:1, p_stage_id:1, p_score: 99999})` يدوياً — المفروض ترفضه بخطأ بدل ما تقبله.

---

<a name="phase-5"></a>
## 9. المرحلة 5: لاحقاً — Next.js

دي خطوة منفصلة عن الـ backend فعلياً، ومقترحة تيجي *بعد* ما تستقر المراحل التانية، مش معاها في نفس الوقت — بتغيّر إطار العمل نفسه (framework)، ولو غيّرت frontend وbackend مع بعض هتضاعف صعوبة تتبّع أي خطأ. لما توصلها هتحتاج دليل منفصل بالكامل (فيه مفاهيم زي Server Components وRoute Handlers)، أقدر أجهّزه لك وقتها.

---

<a name="later"></a>
## 9.5. الأفاتار والشارات والرسائل ✅ (منفّذة)

طُبِّقت في `supabase/migrations/003_avatars_badges_messages.sql`:

- **الأفاتار**: `profiles.character` بقى يقبل 6 قيم بدل 2 (راجع `src/data/avatars.jsx` كمصدر واحد للحقيقة، ومكوّن `<AvatarDisplay avatarKey={...}/>` يُستخدم في كل مكان بدل تكرار منطق العرض).
- **الشارات**: `badges` (تعريفات) + `user_badges` (من كسب إيه)، ممنوحة فقط عبر `award_badge_if_new()`/`check_and_award_badges()` (SECURITY DEFINER) — لا INSERT مباشر لأي دور، فمينفعش مستخدم يمنح نفسه شارة. شارة `ads_5` معرّفة لكن `is_active=false` لحد ما تُبنى ميزة الإعلانات.
- **الرسائل + الإشعارات**: `messages`/`notifications` بحماية RLS كاملة، إرسال عبر `send_message()` فقط (يتحقق من عدم المراسلة الذاتية والفراغ)، وحذف تلقائي بعد 7 أيام عبر `delete_old_messages_and_notifications()` (مجدولة بـ pg_cron أو Edge Function — راجع `supabase/README.md`).
- **تتبّع الوقت/المشاركة**: `track_app_time(seconds)` تُستدعى كل 60 ثانية من `AppContext.jsx` طالما الصفحة ظاهرة، و`track_share()` من زر المشاركة في `ProfilePage.jsx` — كلاهما حماية بسيطة من قيم غير منطقية، مش حماية كاملة من العبث المتعمّد.

**ناقص عن قصد (تحتاج خطوة تالية منفصلة):**
- ربط أزرار الدعم/الاستطلاع في `SettingsDropdown.jsx` بروابطك الحقيقية (حالياً placeholders).
- بناء ميزة الإعلانات فعلياً (Rewarded Ads) لتفعيل شارة `ads_5`.
- 1v1 الحقيقي: `VsComingSoonPage.jsx` مجرد بوابة إعلان الآن، والتصميم الكامل في `VS_MODE_GUIDE.md`.

## 10. حاجات تستاهل تفكّر فيها بعدين

- **إخفاء الإجابة الصحيحة تماماً:** لو حبيت تقفل الثغرة إن `correct_index` ظاهر في DevTools، الحل يبقى RPC function كمان بتاخد إجابة المستخدم وترجّع "صح/غلط" بس، من غير ما الـ`questions` تبعت الإجابة الصحيحة للمتصفح أصلاً. أعقد شوية من المرحلة 4، وممكن نأجّلها لما تحتاجها فعلاً.
- **حماية بيانات القاصرين:** لو المشروع هيستخدمه أطفال حقيقيين (طلابك مثلاً)، راجع القوانين المحلية/الدولية قبل الإطلاق الفعلي — ذكرتها في المرحلة 3 لكنها تستاهل تفكير جدي بدري.
- **تاريخ الإجابات لكل سؤال:** جدول `user_progress` الحالي بيحفظ أفضل نتيجة للمرحلة بس، مش كل محاولة. لو حبيت تحليلات أعمق (مين بيغلط في إيه) ده تصميم إضافي منفصل.
