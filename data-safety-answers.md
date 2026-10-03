# Mesori — إجابات Data Safety (Play Console)

مبنية على الكود الحالي (Supabase Auth + جداول profiles/user_progress/matches/messages). **مسودة، مش استشارة قانونية**، والأفضل يراجعها محامٍ خصوصاً بند الأطفال.

## أسئلة البداية
| السؤال | الإجابة |
|---|---|
| هل التطبيق يجمع أو يشارك بيانات مستخدم؟ | **نعم، يجمع** |
| هل كل البيانات مشفّرة أثناء النقل؟ | **نعم** (HTTPS/Supabase) |
| هل توفّر طريقة لطلب حذف البيانات؟ | **نعم** (بعد تنفيذ بند 1 تحت) |
| رابط حذف الحساب | `https://<username>.github.io/<repo>/privacy-policy.html#delete-account` |
| رابط سياسة الخصوصية | `https://<username>.github.io/<repo>/privacy-policy.html` |

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
1. **مفيش حذف حساب داخل التطبيق.** Google بتشترط زرار حذف داخل التطبيق + رابط ويب. الصفحة بتغطي الرابط، لكن الزرار ناقص. الحل: دالة RPC/Edge Function بمفتاح service-role تنادي `auth.admin.deleteUser`. بما إن `profiles` عليها `ON DELETE CASCADE`، الحذف بيمسح باقي الجداول تلقائياً. **لحد ما تعمله، الإجابة الصادقة على سؤال الحذف "نعم" مش دقيقة كاملة.**
2. **الرسائل بين اللاعبين = محتوى مستخدمين (UGC).** سياسة Google بتطلب آلية إبلاغ وحظر. مفيش في الكود. مع مستخدمين من سن 5 سنين ده أولوية.
3. **سن أدنى 5 سنين في الـ Onboarding.** ده بيدخلك في Families Policy وCOPPA وقانون 151 (موافقة ولي الأمر). الخيارات: (أ) ترفع الحد الأدنى لـ13 وتستهدف مراهقين/كبار، أو (ب) تلتزم بمتطلبات الأطفال كاملة (موافقة ولي أمر، بدون إعلانات غير معتمدة). قرارك القانوني الأهم، ولازم يتحدد قبل ما تختار الفئة العمرية في Play Console.
4. **حذف الرسائل بعد 7 أيام** موجود كدالة (`delete_old_messages_and_notifications`) لكن جدولتها اختيارية في `supabase/README.md`. تأكد إنها مجدولة فعلاً، وإلا السياسة غير صحيحة.
5. **Google Fonts** بتتحمّل من خوادم Google (IP بيتبعت). إما تستضيفها محلياً (الأفضل للأطفال) أو تبقى مذكورة في السياسة (مذكورة).
6. **إيميل التواصل** في `DeveloperInfoPage.jsx` عليه تعليق "بدّله ببريدك الحقيقي". اتأكد إنه الإيميل النهائي، ولو غيّرته حدّث السياسة.
7. **مكان سيرفر Supabase (Region)** مش ظاهر في الريبو. لو مستخدمين من أوروبا فيه التزامات نقل بيانات. ذكر المنطقة في السياسة أفضل.
8. **الجنس:** `PlayerProfileModal` بيعرض `player.gender` بينما `leaderboard_stats` مش فيها العمود ده. اتأكد من مصدره، لأن السياسة بتقول إن العمر والبلد بس مش ظاهرين، والجنس ممكن يكون ظاهر.

## النشر
حط `privacy-policy.html` في `docs/` بالريبو → Settings → Pages → Source: `main` / `docs`.
