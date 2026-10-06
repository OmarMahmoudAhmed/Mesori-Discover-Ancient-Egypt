# تسجيل الدخول بجوجل + توقيع الإصدار + النشر على Google Play

الترتيب هنا هو ترتيب دليل «Android release signing and Play publishing»، والمشروع متجهّز له. اللي بيتنفّذ بنفسك مكتوب صراحةً في كل مرحلة.

## لماذا تسجيل دخول أصلي؟
جوجل تمنع OAuth داخل الـ WebView (`disallowed_useragent`)، فداخل التطبيق يُستخدم تسجيل دخول أصلي (Credential Manager) عبر `@capgo/capacitor-social-login`، ثم يُمرَّر الـ ID token إلى Supabase بـ `signInWithIdToken` مع nonce. على الويب يبقى `signInWithOAuth`. الكود: `src/lib/googleAuth.js`.

## إعداد لمرة واحدة

**Google Cloud**
1. OAuth consent screen: أكمله (وأضف حسابات الاختبار في Test users أثناء التطوير).
2. أنشئ **OAuth client من نوع Web application** → انسخ الـ Client ID والـ Secret.
3. ستنشئ **3 Android clients** على مراحل (المراحل 1 و2 و5 تحت). كلهم بنفس الـ Package name: `com.omarmahmoud.mesori`.

**Supabase**: Authentication ← Providers ← Google ← فعّله وحط **Web Client ID** و**Secret**، واترك «Skip nonce checks» **مُعطّلاً** (الكود يرسل nonce).

**متغيرات البيئة** (`.env` المحلي، وفي Vercel لو بتنشر نسخة الويب):
```
VITE_GOOGLE_WEB_CLIENT_ID=<Web client ID>.apps.googleusercontent.com
```
معرّف عام وليس سراً. أما `SUPABASE_SERVICE_ROLE_KEY` فمكانه الوحيد `.env` المحلي ولا يبدأ بـ `VITE_` ولا يُوضع في Vercel (راجع `.env.example`).

## المرحلة 1 — الآن وأنت بتطوّر (Debug)
من Android Studio، افتح Terminal:
```bash
cd android
./gradlew signingReport
```
انسخ **SHA-1** الخاص بـ `debug` وأضفه في Google Cloud: **Clients ← Create client ← Android** (Package name أعلاه) ← Create. كده تقدر تجرّب الدخول بجوجل على المحاكي/جهازك.

> الـ debug keystore مختلف من جهاز لجهاز؛ لو اشتغلت من جهاز تاني أضف SHA-1 بتاعه.
> على Windows (PowerShell) اكتب `.\gradlew` بدل `./gradlew` (أو `gradlew.bat`).

## المرحلة 2 — قبل أول رفع: Release keystore
**أ) إنشاء الملف (مرة واحدة في عمر المشروع)**، من داخل مجلد `android/`:
```bash
keytool -genkey -v -keystore mesori-release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias mesori-release
```
اختَر كلمة مرور قوية واحفظها في مدير كلمات مرور.

**ب) احفظ الملف في مكان آمن:** لا ترفعه على GitHub أبداً (`*.keystore` و`*.jks` و`keystore.properties` كلها في `.gitignore`، وتحققنا من ده). اعمل نسخة احتياطية في مكان خاص بك خارج الجهاز. لو ضاع، مش هتقدر تحدّث التطبيق بالمفتاح ده؛ ومع Play App Signing (المفعّل غالباً افتراضياً) ممكن تطلب من دعم Google إعادة ضبط الـ upload key، لكنه إجراء بطيء فالأفضل ما يضيعش.

**ج) SHA-1 الخاص به:**
```bash
keytool -list -v -keystore mesori-release.keystore -alias mesori-release
```
**د)** أضفه في Google Cloud: **Clients ← Create client ← Android** (نفس الـ Package name، SHA-1 الجديد).
دلوقتي عندك Android client اتنين: debug وrelease.

## المرحلة 3 — ربط الـ keystore بالمشروع (جاهز في الكود)
`android/app/build.gradle` بيقرأ بيانات التوقيع من `android/keystore.properties` (مفيش كلمات مرور في الكود):

1. انسخ `android/keystore.properties.example` إلى `android/keystore.properties`.
2. املأ `storePassword` و`keyPassword` (الأسماء الافتراضية فيه: `storeFile=../mesori-release.keystore` و`keyAlias=mesori-release` — مطابقة للأمر فوق).

سلوك البناء:
- **من غير `keystore.properties`** (تطوير/`signingReport`): كل حاجة شغّالة، وبناء release بيطلع **غير موقّع** مع تحذير واضح.
- **ملف ناقص أو الـ keystore مش موجود**: بناء release بيفشل برسالة تحدد المشكلة.
- بناء release بيحذّر لو `admob_app_id` ما زال معرّف الاختبار (راجع `docs/ADMOB_SETUP.md`).

## المرحلة 4 — ابنِ الـ Release وارفعه على Play Console
```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease -PversionCode=1 -PversionName=1.0
```
الناتج: `android/app/build/outputs/bundle/release/app-release.aab`. زوّد `versionCode` مع **كل** رفع جديد (لازم رقم أكبر من السابق).

في [Play Console](https://play.google.com/console): أنشئ التطبيق وارفع الـ AAB على **Internal testing** (مش لازم Production من أول مرة).

> قبل الرفع: تأكد من الـ merged manifest (`android/app/build/intermediates/merged_manifests/release*/AndroidManifest.xml`) وجرّب الـ AAB الموقّع على جهاز حقيقي.

## المرحلة 5 — SHA-1 الأخير من Play Console
بعد أول رفعة: **Setup ← App integrity** (أو App signing؛ الاسم بيختلف بين نسخ الواجهة) ← تحت «App signing key certificate» انسخ **SHA-1**، وأضفه في Google Cloud كـ **Android client تالت**. دلوقتي عندك 3: debug وrelease وPlay signing.

> ده الأهم للمستخدمين الفعليين: Google Play بتعيد توقيع التطبيق بمفتاحها، فمن غير SHA-1 ده الدخول بجوجل مش هيشتغل في النسخة المنشورة.

## ملخص الترتيب
| المرحلة | وقتها | الحالة في المشروع |
|---|---|---|
| Debug SHA-1 | الآن | عليك (أمر + Google Cloud) |
| Release keystore + SHA-1 | قبل أول رفع | عليك (keytool + Google Cloud) |
| ربط الـ keystore | قبل أول build | **جاهز** في `build.gradle` |
| bundleRelease + Internal testing | بعد التطوير | جاهز، والرفع عليك |
| Play App Signing SHA-1 | بعد أول رفعة | عليك (Google Cloud) |

## قائمة تحقق قبل أول رفع (من ملفات المستودع)
- رابط سياسة الخصوصية شغّال (GitHub Pages: `main` / `docs`) ومكتوب في Play Console ← App content. السياسة اتحدّثت لتغطي الإعلانات.
- Data safety محدّث بإجابات `data-safety-answers.md` (بما فيها AdMob) + Ads: نعم + Advertising ID: نعم + Target audience: 13+ فقط.
- حذف الحساب: رابط `…/privacy-policy.html#delete-account`، والـ Edge Function `delete-user-account` منشورة.
- حسابات تجريبية للمراجعين (App access) لو التطبيق بيطلب تسجيل دخول.
- مفتاح `service_role` اتدوّر قبل نشر المستودع علناً.

## الإشعارات
- أيقونة الإشعار: `android/app/src/main/res/drawable/ic_stat_mesori.xml` (أبيض على شفاف)، ومضبوطة في `capacitor.config.json`.
- `POST_NOTIFICATIONS` مُعلنة في الـ manifest وتُطلب وقت التشغيل من `src/lib/notifications.js`. بدون `SCHEDULE_EXACT_ALARM`.

## اختبار يدوي على جهاز حقيقي (لم يُنفَّذ آلياً)
- دخول بجوجل لحساب جديد ← Onboarding. حساب موجود ← يدخل مباشرة.
- إلغاء النافذة ← لا رسالة خطأ. وضع الطيران ← رسالة الشبكة.
- خروج ثم دخول من جديد.
- إشعار تذكير عدم النشاط يظهر بالأيقونة الصحيحة على Android 13+.
- الدخول بجوجل من نسخة منزّلة من Play (Internal testing) بعد إضافة SHA-1 الخاص بـ Play signing.
