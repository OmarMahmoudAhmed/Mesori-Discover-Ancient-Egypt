# قاعدة بيانات Mesori (Supabase)

## كيفية التطبيق
شغّل الملفات الثلاثة **بالترتيب** من [Supabase Dashboard](https://app.supabase.com) → **SQL Editor**:
1. `migrations/001_schema.sql` — الجداول الأساسية (levels/stages/questions/profiles/user_progress).
2. `migrations/002_auth_and_leaderboard.sql` — تسجيل الدخول + قائمة المتصدرين الحقيقية.
3. `migrations/003_avatars_badges_messages.sql` — الأفاتار الموسّع + الشارات + الرسائل والإشعارات.

كل ملف يبدأ بـ `DROP TABLE IF EXISTS ... CASCADE` أو `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`،
فتشغيلهم آمن حتى لو شغّلتهم أكتر من مرة بالغلط.

بعد نجاح الثلاثة، شغّل `node scripts/seed.js` من جذر المشروع لرفع المستويات
والمراحل والأسئلة (يحتاج `.env` فيه `VITE_SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`
— راجع `.env.example`).

## لماذا `DROP TABLE` وليس `ALTER TABLE` في 001؟
السكيما القديمة كانت تحتوي على مشكلة بنيوية (id غير فريد عبر المستويات/المراحل)
تسببت في فقدان بيانات صامت أثناء الرفع الأول. بما أن المشروع لم يكن قد أُطلق
بعد، فحذف الجداول القديمة الناقصة وإعادة الرفع بالكامل كان أبسط وأضمن.

## هيكل المفاتيح
- `stages`: مفتاح أساسي مركّب `(level_id, id)` — لأن `id` يتكرر 1-5 داخل كل مستوى.
- `questions`: مفتاح أساسي مركّب `(level_id, stage_id, id)` — لأن `id` يتكرر 1-10
  داخل كل مرحلة. هذا التصميم متعمّد في `src/data/*.js` (id محلي وليس عام).

## profiles / user_progress / الأفاتار
تسجيل الدخول شغّال فعلياً الآن (راجع Trigger `on_auth_user_created` في
002). عمود `character` في `profiles` بقى يقبل 6 قيم: `boy`, `girl`,
`pharaoh`, `anubis`, `scarab`, `ankh` (بدل ولد/بنت بس).

## الشارات (badges / user_badges)
تعريفات الشارات في جدول `badges` (قابلة للتوسعة لاحقاً بإضافة صفوف جديدة).
`check_and_award_badges()` بتفحص الشروط تلقائياً بعد كل `record_stage_progress`/
`track_share`/`track_app_time`. شارة `ads_5` معرّفة لكن `is_active=false`
لحد ما تُبنى ميزة الإعلانات فعلياً.

## الرسائل والإشعارات — الحذف التلقائي بعد أسبوع
دالة `delete_old_messages_and_notifications()` (في 003) بتحذف أي رسالة/إشعار
أقدم من 7 أيام. اختر طريقة جدولة واحدة:

**الخيار 1 — pg_cron (لو متاح في خطة مشروعك):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'delete-old-messages-notifications',
  '0 3 * * *',  -- كل يوم الساعة 3 صباحاً UTC
  $$SELECT public.delete_old_messages_and_notifications();$$
);
```

**الخيار 2 — Supabase Edge Function (`supabase/functions/cleanup-old-messages/`):**
```bash
supabase functions deploy cleanup-old-messages
```
ثم جدولها من Dashboard → Database → Cron Jobs (تستدعي رابط الدالة يومياً)،
أو أي خدمة جدولة خارجية (cron-job.org، GitHub Actions scheduled workflow).

## الإبلاغ، فلترة الرسائل، وحذف الحساب (Google Play)

**1) شغّل `migrations/014_reports_and_message_filter.sql`** (SQL Editor أو `supabase db push`). بيضيف:
- `detect_contact_info()` + تحديث `send_message()`: السيرفر بيرفض أي رسالة فيها رقم هاتف/إيميل/رابط (خطأ `CONTACT_INFO_PHONE|EMAIL|LINK`). فلتر الواجهة في `src/lib/messageFilter.js` لازم يفضل متطابق معاه.
- جدول `user_reports` + `report_user()`. الجدول مقفول تماماً على المستخدمين (RLS من غير policies)؛ المراجعة من الـ Dashboard بحساب الأدمن. `status` = `pending | reviewed | action_taken | dismissed`.
- تحديث `delete_old_messages_and_notifications()` ليحذف كمان البلاغات الأقدم من 180 يوم (**لازم تكون مجدولة** — راجع القسم اللي فوق، وإلا سياسة الاحتفاظ في صفحة الخصوصية مش مطبّقة).

**2) انشر دالة حذف الحساب:**
```bash
supabase functions deploy delete-user-account
```
- بتشتغل بهوية الـ JWT بس (مفيش user id في جسم الطلب) وبمفتاح `service_role` اللي Supabase بيحقنه تلقائياً.
- بتنادي `prepare_account_deletion(uid)` الأول (مباريات 1 ضد 1 الجارية بتتحسب انسحاب والخصم بيفوز، ومباريات البوت بتتمسح)، وبعدين بتمسح `auth.users` فتتمسح باقي الجداول بالـ `ON DELETE CASCADE`.
- `matches.player_1_id / player_2_id / winner_id` = `ON DELETE SET NULL` (migration 015): مباريات الخصم بتفضل في تاريخه، والطرف المحذوف بيظهر كـ«حساب محذوف». `user_reports` بتفضل (بدون ربط) عمداً.

**2.5) شغّل `migrations/015_account_deletion_and_min_age.sql`:**
- بيحل مشكلة `winner_id` / مباريات الخصم، وبيضيف `prepare_account_deletion` (service_role بس).
- حد أدنى للسن 13 على السيرفر (trigger `enforce_min_age` — بيفحص بس عند تغيير السن أو تفعيل onboarding، فالحسابات القديمة ما بتتكسرش).
- بيوسّع `delete_old_messages_and_notifications()`. الـ cron job `daily-cleanup-and-keepalive` (03:00 UTC) بينادي عليها أصلاً، فمفيش جدولة جديدة. اتأكد إنه شغّال: `select * from cron.job_run_details order by start_time desc limit 5;`

**3) متغيّرات بيئة الواجهة (اختيارية، وقت الـ build):**
- `VITE_PRIVACY_POLICY_URL`: رابط صفحة السياسة (الافتراضي صفحة GitHub Pages).
- `VITE_DEVELOPER_PORTFOLIO_URL`: رابط صحيفة أعمال المطوّر. من غيره الزر مبيظهرش في «عن المطوّر».

