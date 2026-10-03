-- ============================================================
-- 014_reports_and_message_filter.sql
-- ============================================================
-- متطلبات سياسة Google Play لمحتوى المستخدمين (UGC):
--   1) فلترة جانب السيرفر: منع الرسائل اللي فيها رقم هاتف/إيميل/رابط/حساب سوشيال
--      (طبقة ثانية وراء فلتر الواجهة src/lib/messageFilter.js — لازم
--      الاتنين يفضلوا متطابقين).
--   2) نظام إبلاغ عن لاعب/رسالة (report_user) + جدول user_reports.
--   3) حذف البلاغات القديمة ضمن دالة التنظيف الموجودة (180 يوم).
--
-- حذف الحساب نفسه مش محتاج تغيير هنا: كل الجداول عليها
-- ON DELETE CASCADE من profiles ← auth.users، والبلاغات هنا
-- ON DELETE SET NULL عمداً (راجع الشرح تحت).
-- ============================================================

BEGIN;

-- ============================================================
-- 1) كاشف بيانات التواصل (يرجع 'email' | 'link' | 'social' | 'phone' | NULL)
-- ============================================================
-- مطابق حرفياً لـ src/lib/messageFilter.js — أي تعديل هنا يتكرر هناك
-- (والعكس)، والاختبارات في messageFilter.test.js بتغطي نفس الحالات.
--
-- خطوات التطبيع: NFKC ← شيل الأحرف غير المرئية/التشكيل/التطويل ← أرقام
-- عربية/فارسية → 0-9 ← lowercase ← توحيد الألف/الياء/التاء المربوطة ←
-- فك التمويه ("gmail dot com"، "x (at) y"، "x @ y . com").
--
-- الترتيب: إيميل ← رابط ← سوشيال ← هاتف.
-- الهاتف: (أ) 8 أرقام متتالية بينها حتى 3 رموز مش حروف، أو (ب) إجمالي
-- 11 رقم أو أكتر في الرسالة، بعد تحويل الأرقام المكتوبة بالحروف لأرقام.
-- حد معروف: دومين بامتداد برّه القائمة، وتهريب أقل من 11 رقم بحروف بينهم.

-- التطبيع الأساسي (مشترك بين كل الفحوص)
CREATE OR REPLACE FUNCTION public._contact_base(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    lower(
      regexp_replace(
        normalize(coalesce(p_text, ''), NFKC),
        '[\u00AD\u061C\u0640\u064B-\u065F\u0670\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]',
        '', 'g')
    ),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹أإآىة',
    '01234567890123456789ااايه'
  );
$$;

-- نفس التطبيع + الأرقام المكتوبة بالحروف اتحوّلت لأرقام (بدون padding)
CREATE OR REPLACE FUNCTION public._contact_digit_stream(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text := public._contact_base(p_text);
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('(^|[^ء-ي])صفر(?=[^ء-ي]|$)', '0'),
      ('(^|[^ء-ي])واحده?(?=[^ء-ي]|$)', '1'),
      ('(^|[^ء-ي])(?:اتنين|اثنين|اثنان|اثنتين|تنين)(?=[^ء-ي]|$)', '2'),
      ('(^|[^ء-ي])(?:تلات|ثلاث)ه?(?=[^ء-ي]|$)', '3'),
      ('(^|[^ء-ي])اربعه?(?=[^ء-ي]|$)', '4'),
      ('(^|[^ء-ي])خمسه?(?=[^ء-ي]|$)', '5'),
      ('(^|[^ء-ي])سته?(?=[^ء-ي]|$)', '6'),
      ('(^|[^ء-ي])سبعه?(?=[^ء-ي]|$)', '7'),
      ('(^|[^ء-ي])(?:تمان|ثمان)(?:يه)?(?=[^ء-ي]|$)', '8'),
      ('(^|[^ء-ي])تسعه?(?=[^ء-ي]|$)', '9'),
      ('(^|[^a-z])zero(?=[^a-z]|$)', '0'),
      ('(^|[^a-z])one(?=[^a-z]|$)', '1'),
      ('(^|[^a-z])two(?=[^a-z]|$)', '2'),
      ('(^|[^a-z])three(?=[^a-z]|$)', '3'),
      ('(^|[^a-z])four(?=[^a-z]|$)', '4'),
      ('(^|[^a-z])five(?=[^a-z]|$)', '5'),
      ('(^|[^a-z])six(?=[^a-z]|$)', '6'),
      ('(^|[^a-z])seven(?=[^a-z]|$)', '7'),
      ('(^|[^a-z])eight(?=[^a-z]|$)', '8'),
      ('(^|[^a-z])nine(?=[^a-z]|$)', '9')
    ) AS v(pat, digit)
  LOOP
    t := regexp_replace(t, r.pat, E'\\1' || r.digit, 'g');
  END LOOP;
  RETURN t;
END;
$$;

-- عدد الأرقام في النص (بعد التطبيع وتحويل الأرقام المكتوبة بالحروف)
CREATE OR REPLACE FUNCTION public._contact_digit_count(p_text text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT length(regexp_replace(public._contact_digit_stream(p_text), '[^0-9]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.detect_contact_info(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t      text;
  prev   text;
  d      text;
  i      integer;
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;

  t := public._contact_base(p_text);

  -- فك تمويه الفواصل (بيتكرر لحد ما النص يثبت، حد أقصى 3 مرات)
  FOR i IN 1..3 LOOP
    prev := t;
    t := regexp_replace(t, '([a-z0-9])\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\}|\(\.\)|\[\.\]|\s(?:dot|نقطه)\s)\s*([a-z0-9])', E'\\1.\\2', 'g');
    t := regexp_replace(t, '([a-z0-9])\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\{\s*at\s*\}|\sat\s)\s*([a-z0-9])', E'\\1@\\2', 'g');
    t := regexp_replace(t, '\s*@\s*', '@', 'g');
    t := regexp_replace(t, '([a-z0-9])\s+\.\s+([a-z0-9])', E'\\1.\\2', 'g');
    EXIT WHEN t = prev;
  END LOOP;

  IF t ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RETURN 'email';
  END IF;

  IF t ~ '(https?://|www\.)[^\s]+'
     OR t ~ '(^|[^a-z0-9-])[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(com|net|org|info|io|me|co|eg|app|link|ly|gl|tv|xyz|online|site|store|ai|dev|cc|biz|click|top|shop|live|club|gg|pro|vip|art|tk|ru|de|uk|fr|sa|ae|kw|qa|tech|space|website|page|bio|fun|cloud|one|us|ws|sh|ca)([^a-z0-9]|$)'
  THEN
    RETURN 'link';
  END IF;

  IF t ~ '(^|[^a-z0-9._%+-])@[a-z0-9_.]{3,}'
     OR t ~ '(^|[^a-z])(whats ?app|watsapp|telegram|instagram|insta|snapchat|facebook|messenger|discord|tik ?tok|skype|viber|wechat)([^a-z]|$)|واتس|وتساب|تيليجرام|تليجرام|تلجرام|تلغرام|تيليغرام|انستجرام|انستغرام|انستا|سناب شات|سنابشات|فيسبوك|فيس بوك|ماسنجر|ميسنجر|ديسكورد|تيك توك|تيكتوك|سكايب|فايبر|سناب([^ء-ي]|$)'
  THEN
    RETURN 'social';
  END IF;

  d := public._contact_digit_stream(p_text);
  IF d ~ '[0-9]([^a-z0-9\u0621-\u064A\u0671-\u06D3]{0,3}[0-9]){7,}'
     OR length(regexp_replace(d, '[^0-9]', '', 'g')) >= 11
  THEN
    RETURN 'phone';
  END IF;

  RETURN NULL;
END;
$$;

-- دوال داخلية: مش محتاجة تتنادى من العميل (send_message SECURITY DEFINER بتستخدمها)
REVOKE ALL ON FUNCTION public._contact_base(text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._contact_digit_stream(text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._contact_digit_count(text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_contact_info(text)    FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2) send_message: نفس منطق 003 بالظبط + فحص بيانات التواصل
-- ============================================================
-- الخطأ برسالة ثابتة 'CONTACT_INFO_<TYPE>' عشان الواجهة تعرضها بالعربي.
-- فحص إضافي ضد تقسيم الرقم على رسائل: لو الرسالة الحالية فيها 3 أرقام أو
-- أكتر، ومجموع أرقامها مع آخر 5 رسائل لنفس المستلم خلال 15 دقيقة 11 أو أكتر
-- → مرفوضة كرقم هاتف.
CREATE OR REPLACE FUNCTION public.send_message(p_recipient_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_sender_name text;
  v_contact     text;
  v_recent      text;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF v_sender_id = p_recipient_id THEN
    RAISE EXCEPTION 'مينفعش تبعت رسالة لنفسك';
  END IF;
  IF length(trim(coalesce(p_content, ''))) = 0 THEN
    RAISE EXCEPTION 'الرسالة فارغة';
  END IF;

  v_contact := public.detect_contact_info(p_content);
  IF v_contact IS NOT NULL THEN
    RAISE EXCEPTION 'CONTACT_INFO_%', upper(v_contact);
  END IF;

  IF public._contact_digit_count(p_content) >= 3 THEN
    SELECT string_agg(content, ' ') INTO v_recent
    FROM (
      SELECT content
      FROM messages
      WHERE sender_id = v_sender_id
        AND recipient_id = p_recipient_id
        AND created_at > now() - interval '15 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    ) r;
    IF v_recent IS NOT NULL
       AND public._contact_digit_count(v_recent || ' ' || p_content) >= 11 THEN
      RAISE EXCEPTION 'CONTACT_INFO_PHONE';
    END IF;
  END IF;

  INSERT INTO messages (sender_id, recipient_id, content)
  VALUES (v_sender_id, p_recipient_id, trim(p_content));

  SELECT username INTO v_sender_name FROM profiles WHERE id = v_sender_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (p_recipient_id, 'message', 'رسالة جديدة من ' || v_sender_name, trim(p_content), v_sender_id::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;

-- ============================================================
-- 3) جدول البلاغات
-- ============================================================
-- reporter_id / reported_user_id = ON DELETE SET NULL (مش CASCADE) عمداً:
-- لو المُبلَّغ عنه حذف حسابه بعد البلاغ، لازم البلاغ يفضل قدام المراجِع.
-- عشان كده بنحتفظ بنسخة من اسمه ومن نص الرسالة وقت البلاغ (الرسائل نفسها
-- بتتمسح بعد 7 أيام). ده لازم يتذكر في سياسة الخصوصية (متذكّر فعلاً).
CREATE TABLE IF NOT EXISTS public.user_reports (
  id                bigserial PRIMARY KEY,
  reporter_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_username text,
  message_id        bigint,          -- بدون FK: الرسالة الأصلية بتتمسح بعد 7 أيام
  reported_content  text CHECK (reported_content IS NULL OR char_length(reported_content) <= 500),
  reason            text NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','personal_info','other')),
  details           text CHECK (details IS NULL OR char_length(details) <= 500),
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','reviewed','action_taken','dismissed')),
  action_taken      text,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_reports_status   ON public.user_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON public.user_reports(reporter_id, created_at DESC);

-- RLS شغّال ومفيش ولا policy ولا GRANT لـ anon/authenticated:
-- المستخدم مايقدرش يقرأ/يعدّل/يكتب في الجدول مباشرة، الكتابة فقط عبر
-- report_user() تحت، والمراجعة من Supabase Dashboard (service role).
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_reports FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.user_reports_id_seq FROM anon, authenticated;

-- ============================================================
-- 4) report_user(): الإبلاغ عن لاعب (مع رسالة اختيارياً)
-- ============================================================
-- p_notification_id: لو البلاغ عن رسالة، بنبعت id الإشعار (الإشعار هو اللي
-- بيظهر للمستلم، و related_id فيه = id المرسل). الدالة تتأكد إن الإشعار
-- بتاع المبلّغ نفسه وإن المرسل هو المُبلَّغ عنه، وتاخد نسخة من النص من
-- السيرفر (مش من العميل) عشان محدش يفبرك دليل.
CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_user_id uuid,
  p_reason           text,
  p_details          text   DEFAULT NULL,
  p_notification_id  bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter   uuid := auth.uid();
  v_name       text;
  v_content    text;
  v_message_id bigint;
  v_details    text := nullif(trim(coalesce(p_details, '')), '');
BEGIN
  IF v_reporter IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF v_reporter = p_reported_user_id THEN
    RAISE EXCEPTION 'مينفعش تبلّغ عن نفسك';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','inappropriate','personal_info','other') THEN
    RAISE EXCEPTION 'سبب البلاغ غير صالح';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    v_details := left(v_details, 500);
  END IF;

  SELECT username INTO v_name
  FROM profiles
  WHERE id = p_reported_user_id AND is_bot = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'اللاعب غير موجود';
  END IF;

  -- حد يومي لمنع إغراق الجدول ببلاغات وهمية
  IF (SELECT count(*) FROM user_reports
      WHERE reporter_id = v_reporter AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'وصلت للحد اليومي من البلاغات، حاول بكرة';
  END IF;

  IF p_notification_id IS NOT NULL THEN
    SELECT body INTO v_content
    FROM notifications
    WHERE id = p_notification_id
      AND user_id = v_reporter
      AND type = 'message'
      AND related_id = p_reported_user_id::text;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الرسالة غير موجودة';
    END IF;

    SELECT id INTO v_message_id
    FROM messages
    WHERE sender_id = p_reported_user_id
      AND recipient_id = v_reporter
      AND content = v_content
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO user_reports
    (reporter_id, reported_user_id, reported_username, message_id, reported_content, reason, details)
  VALUES
    (v_reporter, p_reported_user_id, v_name, v_message_id, left(v_content, 500), p_reason, v_details);
END;
$$;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, bigint) TO authenticated;

-- ============================================================
-- 5) التنظيف: نفس دالة 003 + حذف البلاغات الأقدم من 180 يوم
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_old_messages_and_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM messages      WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM user_reports  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$;

COMMIT;
