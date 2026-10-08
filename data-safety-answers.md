# Mesori — إجابات Data Safety (Play Console)

مبنية على الكود الحالي (Supabase Auth + جداول profiles/user_progress/matches/messages). **مسودة، مش استشارة قانونية**، والأفضل يراجعها محامٍ خصوصاً بند الأطفال.

## أسئلة البداية
| السؤال | الإجابة |
|---|---|
| هل التطبيق يجمع أو يشارك بيانات مستخدم؟ | **نعم، يجمع** |
| هل كل البيانات مشفّرة أثناء النقل؟ | **نعم** (HTTPS/Supabase) |
| هل توفّر طريقة لطلب حذف البيانات؟ | **نعم** (حذف داخل التطبيق + رابط ويب، بشرط نشر migration 014 والـ Edge Function — راجع `supabase/README.md`) |
| رابط حذف الحساب | `https://mesori.app/privacy-policy.html#delete-account` |
| رابط سياسة الخصوصية | `https://mesori.app/privacy-policy.html` |

## أنواع البيانات
"Shared" = **لا** لبيانات Supabase/Vercel (مزوّدو خدمة بيعالجوا نيابةً عنك ومستثنون من تعريف المشاركة)، و**نعم** لأنواع AdMob اللي تحت (Google بتتلقّاها مباشرة من الـ SDK).

| الفئة في Play Console | النوع | Collected | Shared | إجباري/اختياري | الغرض |
|---|---|---|---|---|---|
| Personal info | Name (اسم المستخدم) | نعم | لا | إجباري | App functionality, Account management |
| Personal info | Email address | نعم | لا | إجباري | Account management |
| Personal info | User IDs | نعم | لا | إجباري | App functionality, Account management |
| Personal info | Other info (العمر، الجنس، البلد) | نعم | لا | إجباري (العمر) | App functionality |
| Messages | Other in-app messages | نعم | لا | اختياري | App functionality |
| App activity | App interactions (تقدم، نقاط، إجابات، مباريات، مدة الاستخدام) | نعم | لا | إجباري | App functionality |
| App activity | App interactions (تفاعلات الإعلانات: فتح التطبيق، النقرات، مشاهدات الفيديو — من AdMob) | **نعم** (AdMob) | **نعم** (Google) | اختياري | Advertising or marketing، Analytics، Fraud prevention |
| App activity | Other user-generated content | لا (الرسائل مغطاة فوق) | — | — | — |
| Location | Approximate location (تقدير من الـ IP بواسطة AdMob) | **نعم** (AdMob) | **نعم** (Google) | اختياري | Advertising or marketing، Analytics، Fraud prevention |
| Contacts / Photos / Audio / Files / Calendar | — | **لا** | — | — | — |
| Financial info | — | **لا** (رابط Buy Me a Coffee خارجي) | — | — | — |
| Device or other IDs | Advertising ID + App set ID (+ معرّفات حسابات الجهاز إن وُجدت) | **نعم** (AdMob) | **نعم** (Google) | اختياري | Advertising or marketing، Analytics، Fraud prevention |
| App info and performance | Diagnostics (زمن تشغيل التطبيق، hang rate، استهلاك الطاقة — من AdMob) | **نعم** (AdMob) | **نعم** (Google) | اختياري | Analytics، Fraud prevention |
| App info and performance | Crash logs | **لا** | — | — | — |

- **Independent security review:** لا.
- **AdMob:** الكود فيه SDK الإعلانات دلوقتي (مقفول افتراضياً من Supabase بـ `enable_ads=false`)، لكن الإفصاح لازم يتحدّث من **أول نسخة** بتتضمّنه حتى لو الإعلانات مقفولة. راجع القسم التالي.

## إعلانات AdMob — إجابات إضافية (محدّث 2026-10-06)

مصدر الجدول: صفحة Google الرسمية «Google Play data disclosure» لـ Google Mobile Ads SDK (https://developers.google.com/admob/android/privacy/play-data-disclosure — راجعها قبل التقديم لأنها بتتحدّث مع إصدارات الـ SDK). الصفحة بتقول إن الـ SDK بيجمع ويشارك تلقائياً: **عنوان IP** (ممكن يُستخدم لتقدير الموقع التقريبي)، **تفاعلات المستخدم مع المنتج** (فتح التطبيق، نقرات، مشاهدات فيديو)، **معلومات التشخيص** (زمن التشغيل، hang rate، الطاقة)، **معرّفات الجهاز والحساب** (Advertising ID وApp set ID ومعرّفات حسابات الجهاز) — لأغراض الإعلان والتحليلات ومنع الاحتيال، وكلها مشفّرة أثناء النقل (TLS). جمع الـ Advertising ID اختياري (المستخدم يقدر يعيد ضبطه أو يحذفه). **القرار النهائي في الإجابة مسؤوليتك** (Google نفسها بتقول كده)؛ الجدول فوق هو الأسلم.

في Play Console لازم تجاوب كمان:

| الصفحة | الإجابة |
|---|---|
| App content ← Ads | **نعم، يحتوي على إعلانات** |
| App content ← Advertising ID | **نعم** — الأغراض: Advertising or marketing + Analytics (+ Fraud prevention). والـ SDK بيضيف `com.google.android.gms.permission.AD_ID` تلقائياً عند دمج الـ manifest (تأكد منه في الـ AAB النهائي). ومعرّف AdMob (`APPLICATION_ID`) اتضاف للـ manifest بمعرّف اختبار لحد ما تستبدله بمعرّفك الحقيقي |
| App content ← Target audience | **13–15 و16–17 و18+** فقط (Play Console ما فيهوش خيار "13+" مباشر — ما تختارش أي فئة أصغر). التطبيق **غير موجّه للأطفال** وغير مشارك في برنامج Families. الإعلانات لازم تتوافق مع سياسة Ads في Google Play |
| Data safety | الصفوف المضافة فوق، وتأكد إنها متطابقة مع `privacy-policy.html` (اتحدّثت 2026-10-06) |

ملاحظات:
- **مش بيطبَّق Families Self-Certified Ads SDK** طالما التطبيق 13+ وغير موجّه للأطفال (وده الوضع المعتمد). لكن لو المراجع اعتبره موجّه للأطفال هيطلب Families Policy، وساعتها الإعلانات الحالية مش مسموحة.
- الكود بيحدّ محتوى الإعلانات لمستوى المراهقين (Teen) وبيبعت وسم TFUA لمن هم تحت 16 (سن الموافقة الافتراضي في أوروبا). وبيستخدم UMP (نموذج الموافقة من Google) — لازم تنشئ رسالة الموافقة في AdMob ← Privacy & messaging (راجع `docs/ADMOB_SETUP.md`).
- ملف `App Marketing.md` اتحدّث ليطابق القرار: التطبيق فيه إعلانات بينية (بين المراحل) فقط، وموجّه لعمر 13+ وليس للأطفال.

## ⚠️ ثغرات لازم تتقفل قبل التقديم (من مراجعة الكود)
1. ✅ **حذف الحساب داخل التطبيق: اتنفّذ في الكود** (الإعدادات ← «حذف حسابي» ← Edge Function `delete-user-account`). **مش شغّال على الإنتاج لحد ما تنشر الدالة** (`supabase functions deploy delete-user-account`) وتجرّب حذف حساب تجريبي من نسخة مبنية. الرابط الويب = قسم 6 في صفحة السياسة (`#delete-account`).
2. ✅/⚠️ **الإبلاغ + فلترة الرسائل: اتنفّذوا** (زر العلم في الإشعارات وبروفايل اللاعب، جدول `user_reports`، وفلتر أرقام/إيميلات/روابط في الواجهة وفي `send_message` على السيرفر). **لسه ناقص:** (أ) حد يراجع البلاغات فعلياً (Dashboard ← Table Editor ← `user_reports`، مفيش لوحة إدارة)، (ب) حظر لاعب (مش مطلوب صراحةً من Google لكن موصى به).
3. **السن الأدنى (اتحلّت):** الحد الأدنى بقى 13 (بوابة سن قبل التسجيل + onboarding + trigger على السيرفر). في Play Console اختر الفئة العمرية 13+ و«التطبيق غير موجّه للأطفال»، ولازم وصف المتجر والصور والتسويق ما يستهدفوش أطفالاً. لو المراجع شاف المحتوى موجّه للأطفال ممكن يطلب Families Policy.
4. **حذف الرسائل بعد 7 أيام** موجود كدالة (`delete_old_messages_and_notifications`) لكن جدولتها اختيارية في `supabase/README.md`. تأكد إنها مجدولة فعلاً، وإلا السياسة غير صحيحة.
5. **Google Fonts** بتتحمّل من خوادم Google (IP بيتبعت). إما تستضيفها محلياً (الأفضل للأطفال) أو تبقى مذكورة في السياسة (مذكورة).
6. **إيميل التواصل** في `DeveloperInfoPage.jsx` عليه تعليق "بدّله ببريدك الحقيقي". اتأكد إنه الإيميل النهائي، ولو غيّرته حدّث السياسة.
7. **مكان سيرفر Supabase (Region)** مش ظاهر في الريبو. لو مستخدمين من أوروبا فيه التزامات نقل بيانات. ذكر المنطقة في السياسة أفضل.
8. **الجنس:** `PlayerProfileModal` بيعرض `player.gender` بينما `leaderboard_stats` مش فيها العمود ده. اتأكد من مصدره، لأن السياسة بتقول إن العمر والبلد بس مش ظاهرين، والجنس ممكن يكون ظاهر.

## النشر
حط `privacy-policy.html` في `docs/` بالريبو → Settings → Pages → Source: `main` / `docs`.

## إقرارات محتوى المستخدمين (UGC) والسن — محدّث 2026-10-03

الحالة في الكود والسيرفر (migrations 014–016) وإيش تختاره في Play Console:

| البند | الحالة | في Play Console |
|---|---|---|
| الفئة العمرية | حد أدنى 13 (بوابة سن + onboarding + trigger على السيرفر) | Target age: **13–15، 16–17، 18+** (بدون أي فئة أصغر)، والتطبيق **غير موجّه للأطفال** وغير مشارك في Families |
| الإبلاغ داخل التطبيق | موجود (رسالة من الإشعارات، ولاعب من بروفايله) | يغطي سياسة UGC |
| حظر مستخدم | موجود + قائمة «اللاعبون المحظورون» + رفع الحظر | يغطي سياسة UGC |
| شروط تمنع المحتوى المسيء | `docs/terms.html` + موافقة إلزامية قبل أول رسالة (السيرفر بيرفض من غيرها) | يغطي سياسة UGC |
| فلترة المحتوى | السيرفر بيرفض أرقام/إيميلات/روابط/حسابات تواصل + حد 30 رسالة/ساعة | — |
| حذف الحساب | من الإعدادات + رابط ويب: `https://mesori.app/privacy-policy.html#delete-account` | Data safety ← «Account deletion» ← ضع الرابط ده |
| مراجعة البلاغات | يدوي — راجع `docs/moderation-runbook.md` (الهدف 72 ساعة) | — |

لازم تنفّذه بنفسك قبل الرفع:
1. فعّل GitHub Pages (`main` / `docs`) وافتح الرابطين: `privacy-policy.html` و `terms.html`.
2. App content ← Target audience: 13+ بس (ما تختارش فئات أصغر). وصف المتجر والصور ما يستهدفوش أطفالاً.
3. App content ← «User generated content»: أجب بنعم، واذكر الإبلاغ + الحظر + الشروط + الفلترة.
4. فعّل «Leaked password protection» من Supabase Dashboard ← Authentication ← Sign In / Providers ← Email.

