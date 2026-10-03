# دليل استكمال نشر Mesori على Google Play (بعد تحويلها بـ Capacitor)

هذا الدليل يفترض إن `npx cap add android` اتعمل بالفعل، والتطبيق شغّال وتجرب فعلياً على جهاز أندرويد حقيقي. الترتيب هنا مهم — كل قسم مبني على اللي قبله.

**الترتيب الصحيح:** سياسة الخصوصية أولاً (بوابة قانونية، مش تقنية — ممكن تتعمل من دلوقتي وأنت بتشتغل على الباقي) → target API level 36 (شرط رفض تلقائي من Google لو ناقص) → التوقيع (Signing) → تقليل حجم الـ bundle (تحسين، مش شرط رفض) → قائمة التحقق النهائية.

---

## 1. سياسة الخصوصية (Privacy Policy) — البوابة القانونية

### ليه دي أولوية فوق أي حاجة تقنية

Google Play بيرفض أي تطبيق يجمع بيانات مستخدم (وMesori بيعمل كده عن طريق Supabase Auth) من غير رابط privacy policy صالح وشغال في الـ Play Console، وده بيتفحص آلياً وقت الرفع. التطبيق موجّه لطلاب — يعني في احتمال كبير يندرج تحت **Google Play Families Policy** لو هتحدد الفئة العمرية على إنها تشمل قاصرين، وده بيضيف شروط إضافية:
- ممنوع أي إعلانات third-party غير معتمدة من Families Ads program.
- لازم تحديد دقيق لإيه البيانات اللي بتتجمع من مين.
- سياسة الخصوصية لازم تكون واضحة إن التطبيق ممكن يستخدمه أطفال، وتوضح إزاي بتتعامل مع بياناتهم.

### إيه اللي لازم يتكتب فيه بالتحديد (مبني على كود المشروع الفعلي)

من مراجعة الكود، البيانات اللي Mesori بيجمعها فعلياً عن طريق Supabase:
- بريد إلكتروني + طريقة تسجيل الدخول (OAuth social login)
- اسم المستخدم / الاسم الظاهر في الليدربورد
- تقدّم الاختبارات والنتائج (per-answer timing, scores)
- بيانات مباريات الـ 1v1 (vs-match)
- إشعارات محلية عن طريق `@capacitor/local-notifications` (دي محلية على الجهاز، مش بتتبعت لسيرفر — وضّح ده صراحة في السياسة لأنه نقطة كويسة لصالحك)

سياسة الخصوصية لازم توضح: إيه اللي بيتجمع، ليه، فين بيتخزن (Supabase — اذكر اسم مزوّد الخدمة)، هل بيتشارك مع طرف تالت (الافتراض: لأ)، وإزاي المستخدم يقدر يطلب حذف بياناته.

### إزاي تستضيفها مجاناً (GitHub Pages)

1. في نفس الريبو بتاعك، اعمل فرع أو فولدر `docs/privacy-policy.html` (أو صفحة HTML بسيطة بأي محتوى نصي).
2. من إعدادات الريبو على GitHub: **Settings → Pages → Source** اختار الفرع والفولدر (`main` / `docs`).
3. GitHub هيديك رابط شكله `https://<username>.github.io/<repo>/privacy-policy.html` — الرابط ده هو اللي هتحطه في Play Console.
4. لو عايز حد يراجعلك الصياغة القانونية قبل ما تنشرها، قولّي وأكتبلك مسودة كاملة بناءً على البيانات اللي فوق.

### فين تحطها في Play Console

Play Console → App content → Privacy policy → حط الرابط. ده منفصل تماماً عن الـ Data safety form اللي هتملاه كمان (بيسألك نفس الأسئلة تقريباً بس بشكل structured).

---

## 2. متطلب Target API Level 36 (Android 16) — سارٍ فعلياً من 31 أغسطس 2026

هنبدأ بده قبل التوقيع لأنه ممكن يأثر على إعدادات الـ build نفسها. اعتباراً من 31 أغسطس 2026، Google Play **بيرفض أي تطبيق جديد** targetSdkVersion بتاعه أقل من 36 (Android 16). Capacitor templates القديمة نسبياً كانت بتظبط القيمة دي على 34 أو 35.

**الخطوة:** افتح `android/variables.gradle` في مشروعك وتأكد من القيم دي:

```gradle
ext {
    compileSdkVersion = 36
    targetSdkVersion = 36
    minSdkVersion = 23   // أو القيمة اللي مناسبة لأقل جهاز عايز تدعمه
}
```

لو القيم أقل من كده، حدّثها، وبعدين شغّل `npx cap sync android` عشان التغيير ينزل على مشروع الأندرويد. جرّب `npm run build` بعدها كالمعتاد للتأكد إن حاجة ماتكسرتش.

---

## 3. توقيع التطبيق (Signing Keystore)

Google Play مبيقبلش أي APK/AAB غير موقّع. المفتاح ده حياتك المهنية للتطبيق — لو ضاع، مش هتقدر تحدّث نفس التطبيق تاني أبداً بنفس الـ package name.

### إنشاء الـ keystore

من الترمينال (مش من جوه مشروع Capacitor، أي مكان على جهازك):

```bash
keytool -genkey -v -keystore mesori-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mesori-key
```

هيسألك باسورد للـ keystore وباسورد للـ alias (ممكن تخليهم نفس الحاجة) + بيانات زي الاسم والدولة. **احفظ الباسوردات والملف نفسه في مكان آمن منفصل عن الريبو تماماً** — متضيفوش لـ git أبداً (زي درس الـ .env بالظبط).

### ربطه بمشروع الأندرويد

في `android/app/build.gradle`، ضيف قبل `buildTypes`:

```gradle
signingConfigs {
    release {
        storeFile file("/المسار-الكامل-لملف/mesori-release-key.jks")
        storePassword "الباسورد-بتاع-الـ-keystore"
        keyAlias "mesori-key"
        keyPassword "الباسورد-بتاع-الـ-alias"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

**تحذير:** متسيبش الباسوردات مكتوبة نص صريح في الملف ده لو الملف نفسه هيتسجل في git. الطريقة الأسلم: حطهم في `android/keystore.properties` (ملف منفصل، ضيفه في `.gitignore`)، واقرأهم من جوه `build.gradle` بدل ما تكتبهم مباشرة. لو عايز أكتبلك الصيغة دي بالتفصيل قولّي.

### بناء نسخة موقّعة (AAB)

Google Play بياخد **AAB** (Android App Bundle) مش APK عادي. من الترمينال:

```bash
cd android
./gradlew bundleRelease
```

الناتج هيطلع في `android/app/build/outputs/bundle/release/app-release.aab` — ده اللي بترفعه على Play Console.

**بديل أسهل بصرياً:** من Android Studio، بعد `npx cap open android`: **Build → Generate Signed Bundle / APK** واختار Android App Bundle، وهيمشي بيك خطوة خطوة بنفس البيانات دي.

### ملاحظة مهمة: Play App Signing

Google Play هيقترح عليك تفعّل **Play App Signing** وقت أول رفعة — ده يخلي Google نفسه يحتفظ بمفتاح التوقيع النهائي، وإنت بتستخدم الـ keystore بتاعك كـ "upload key" بس. ده أأمن لأنك لو ضيّعت مفتاحك، تقدر تطلب من Google استرجاع الوصول بدل ما التطبيق يضيع نهائي. يُنصح بتفعيله من البداية.

---

## 4. تقليل حجم الـ Bundle (632KB) عن طريق Code Splitting

ده تحسين أداء، مش شرط رفض من Google — تقدر تأجله لبعد أول نشرة لو الوقت ضيّق، بس هو سبب حقيقي لبطء أول فتح للتطبيق على نت ضعيف.

### الوضع الحالي

في `src/App.jsx`، كل الصفحات متستوردة عادي في الأول:

```javascript
import HomePage        from './pages/HomePage';
import QuizGroupPage   from './pages/QuizGroupPage';
import QuizPage        from './pages/QuizPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage     from './pages/ProfilePage';
import VsLobbyPage         from './pages/VsLobbyPage';
import VsMatchPage         from './pages/VsMatchPage';
import DeveloperInfoPage   from './pages/DeveloperInfoPage';
```

وبعدين فيه `switch(currentPage)` جوه `renderPage()` بيرجّع الصفحة المناسبة. ده معناه كل الصفحات دي بتتحمّل مع بعض في نفس ملف الـ 632KB من أول لحظة، حتى لو المستخدم فاتح Home بس.

### التعديل المطلوب

**الخطوة 1** — استورد الصفحات التقيلة بـ `React.lazy` بدل الاستيراد العادي. سيب `HomePage` و`OnboardingPage` و`LoginPage` عاديين لأنهم أول حاجة بتظهر:

```javascript
import React, { useEffect, Suspense } from 'react';
// ...
import HomePage from './pages/HomePage'; // يفضل عادي — أول شاشة

const QuizGroupPage   = React.lazy(() => import('./pages/QuizGroupPage'));
const QuizPage        = React.lazy(() => import('./pages/QuizPage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage     = React.lazy(() => import('./pages/ProfilePage'));
const VsLobbyPage     = React.lazy(() => import('./pages/VsLobbyPage'));
const VsMatchPage     = React.lazy(() => import('./pages/VsMatchPage'));
const DeveloperInfoPage = React.lazy(() => import('./pages/DeveloperInfoPage'));
```

**الخطوة 2** — لف الـ `return renderPage()` (أو المكان اللي بينده فيه) بـ `<Suspense>` مع fallback بسيط (تقدر تستخدم `LoadingAnkh` اللي أصلاً موجود عندك في `components/shared`):

```javascript
<Suspense fallback={<LoadingAnkh />}>
  {renderPage()}
</Suspense>
```

كده أي صفحة من دول مش هتتحمّل إلا لما المستخدم فعلياً يدخلها، وHome هيفضل خفيف.

### التحقق بعد التعديل

```bash
npm run build
```

قارن الناتج بالـ build القديم — المفروض تشوف بدل ملف واحد 632KB، كذا ملف أصغر (chunk لكل صفحة)، والملف الأساسي اللي بيتحمّل الأول يبقى أصغر بكتير.

---

## 5. قائمة تحقق نهائية قبل الرفع على Play Console

- [ ] مفتاح Supabase الـ service_role اتدوّر، والقديم اتمسح من git history بالكامل
- [ ] رابط privacy policy شغّال وحقيقي (مش placeholder) ومحطوط في Play Console → App content
- [ ] `targetSdkVersion` و`compileSdkVersion` = 36 في `android/variables.gradle`
- [ ] الـ keystore اتعمل ومحفوظ في مكان آمن (نسخة احتياطية منفصلة عن جهاز واحد)
- [ ] `./gradlew bundleRelease` بينتج AAB من غير أخطاء
- [ ] Play App Signing مفعّل وقت أول رفعة
- [ ] Data safety form في Play Console متطابق فعلياً مع اللي مكتوب في privacy policy
- [ ] لو مستهدف قاصرين: مراجعة Families Policy checklist كامل من Play Console نفسه
- [ ] (اختياري لكن مهم) code splitting للصفحات التقيلة
- [ ] تجربة فعلية للـ AAB الموقّع على جهاز حقيقي قبل الرفع (مش المحاكي بس)
