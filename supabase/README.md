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

