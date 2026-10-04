# Mesori — إجابات Data Safety (Play Console)

مبنية على الكود الحالي (Supabase Auth + جداول profiles/user_progress/matches/messages). **مسودة، مش استشارة قانونية**، والأفضل يراجعها محامٍ خصوصاً بند الأطفال.

## أسئلة البداية
| السؤال | الإجابة |
|---|---|
| هل التطبيق يجمع أو يشارك بيانات مستخدم؟ | **نعم، يجمع** |
| هل كل البيانات مشفّرة أثناء النقل؟ | **نعم** (HTTPS/Supabase) |
| هل توفّر طريقة لطلب حذف البيانات؟ | **نعم** (حذف داخل التطبيق + رابط ويب، بشرط نشر migration 014 والـ Edge Function — راجع `supabase/README.md`) |
| رابط حذف الحساب | `https://omarmahmoudahmed.github.io/Mesori-Discover-Ancient-Egypt/privacy-policy.html#delete-account` |
| رابط سياسة الخصوصية | `https://omarmahmoudahmed.github.io/Mesori-Discover-Ancient-Egypt/privacy-policy.html` |

## أنواع البيانات
"Shared" = **لا** في كل الصفوف: Supabase/Vercel مزوّدو خدمة بيعالجوا نيابةً عنك (مستثنون من تعريف المشاركة).

| الفئة في Play Console | النوع | Collected | Shared | إجباري/اختياري | الغرض |
|---|---|---|---|---|---|
| Personal info | Name (اسم المستخدم) | نعم | لا | إجباري | App functionality, Account management |
| Personal info | Email address | نعم | لا | إجباري | Account management |
| Personal info | User IDs | نعم | لا | إجباري | App functionality, Account management |
| Personal info | Other info (العمر، الجنس، البلد) | نعم | لا | إجباري (العمر) | App functionality |
| Messages | Other in-app messages | نعم | لا | اختياري | App functionality |
| App activity | App interactions (تقدم، نقاط، إجابات، مباريات، مدة الاستخدام) | نعم | لا | إجباري | App functionality |
| App activity | Other user-generated content | لا (الرسائل مغطاة فوق) | — | — | — |
| Location / Contacts / Photos / Audio / Files / Calendar | — | **لا** | — | — | — |
| Financial info | — | **لا** (رابط Buy Me a Coffee خارجي) | — | — | — |
| Device or other IDs | — | **لا** (مفيش إعلانات/تحليلات) | — | — | — |
| App info and performance | Crash logs / Diagnostics | **لا** | — | — | — |

- **Independent security review:** لا.
- **لو أضفت AdMob لاحقاً:** لازم تحدّث النموذج (Device IDs، Advertising ID، Shared = نعم) والسياسة، وتستخدم Families Self-Certified Ads SDK فقط.

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
| الفئة العمرية | حد أدنى 13 (بوابة سن + onboarding + trigger على السيرفر) | Target age: **13+ فقط**، والتطبيق **غير موجّه للأطفال** |
| الإبلاغ داخل التطبيق | موجود (رسالة من الإشعارات، ولاعب من بروفايله) | يغطي سياسة UGC |
| حظر مستخدم | موجود + قائمة «اللاعبون المحظورون» + رفع الحظر | يغطي سياسة UGC |
| شروط تمنع المحتوى المسيء | `docs/terms.html` + موافقة إلزامية قبل أول رسالة (السيرفر بيرفض من غيرها) | يغطي سياسة UGC |
| فلترة المحتوى | السيرفر بيرفض أرقام/إيميلات/روابط/حسابات تواصل + حد 30 رسالة/ساعة | — |
| حذف الحساب | من الإعدادات + رابط ويب: `.../privacy-policy.html#delete-account` | Data safety ← «Account deletion» ← ضع الرابط ده |
| مراجعة البلاغات | يدوي — راجع `docs/moderation-runbook.md` (الهدف 72 ساعة) | — |

لازم تنفّذه بنفسك قبل الرفع:
1. فعّل GitHub Pages (`main` / `docs`) وافتح الرابطين: `privacy-policy.html` و `terms.html`.
2. App content ← Target audience: 13+ بس (ما تختارش فئات أصغر). وصف المتجر والصور ما يستهدفوش أطفالاً.
3. App content ← «User generated content»: أجب بنعم، واذكر الإبلاغ + الحظر + الشروط + الفلترة.
4. فعّل «Leaked password protection» من Supabase Dashboard ← Authentication ← Sign In / Providers ← Email.

