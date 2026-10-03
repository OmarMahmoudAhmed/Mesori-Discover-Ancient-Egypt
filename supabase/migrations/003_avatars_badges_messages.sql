-- ============================================================
-- Mesori — الشارات + الأفاتار + الرسائل والإشعارات (مع حذف تلقائي)
-- ============================================================
-- يُطبَّق بعد 001_schema.sql و002_auth_and_leaderboard.sql.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) توسيع خيارات الأفاتار (بدل "ولد/بنت" بس)
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_character_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_character_check
  CHECK (character IN ('boy', 'girl', 'pharaoh', 'anubis', 'scarab', 'ankh'));

-- عدادات بسيطة تُغذّي بعض الشارات تحت — عمودان حقيقيان (المشاركة
-- ووقت الاستخدام)، وعمود placeholder لشارة الإعلانات (لسه غير مفعّلة)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_count          integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_seconds          integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rewarded_ads_watched integer NOT NULL DEFAULT 0;

-- ============================================================
-- 2) الشارات (Badges) والإنجازات
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id             text PRIMARY KEY,        -- مثال: 'quiz_10'
  title_ar       text NOT NULL,
  description_ar text NOT NULL,
  icon           text NOT NULL,           -- كلاس Flaticon (fi-sr-...) أو 'badge:اسم_الملف.svg'
  is_active      boolean NOT NULL DEFAULT true  -- false = شارة مُعرَّفة لكن مش قابلة للكسب بعد (زي الإعلانات)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  text NOT NULL REFERENCES badges(id)   ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

INSERT INTO badges (id, title_ar, description_ar, icon, is_active) VALUES
  ('quiz_10',    'عاشق الاختبارات',   'أكملت 10 اختبارات في ميسوري',           'fi-sr-graduation-cap', true),
  ('quiz_25',    'خبير التاريخ',       'أكملت 25 اختباراً في ميسوري',           'fi-sr-book-alt',       true),
  ('all_levels', 'سيد مصر القديمة',   'أكملت كل المستويات الخمسة',             'badge:Mummy.svg',      true),
  ('share_1',    'ناشر المعرفة',       'شاركت ميسوري مع صديق',                  'fi-sr-share',          true),
  ('hours_10',   'المستكشف الدؤوب',   'قضيت 10 ساعات داخل ميسوري',             'fi-sr-clock',          true),
  ('ads_5',      'داعم ميسوري',        'شاهدت 5 إعلانات مكافأة (قريباً)',       'fi-sr-tv-retro',       false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3) الرسائل بين المستخدمين
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id           bigserial PRIMARY KEY,
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages(sender_id, created_at DESC);

-- ============================================================
-- 4) الإشعارات (رسالة جديدة / شارة جديدة... إلخ)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('message', 'badge')),
  title      text NOT NULL,
  body       text,
  related_id text,  -- id الرسالة أو الشارة كنص عام (يخدم أكتر من نوع بدون FK صارم)
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- ============================================================
-- RLS + الصلاحيات
-- ============================================================
ALTER TABLE badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- الشارات: تعريفات عامة (مش بيانات مستخدم)، وكذلك مين كسب أي شارة —
-- لازم تكون قابلة للقراءة العامة عشان "عرض شارات لاعب تاني" في صفحة
-- المتصدرين (مطلوب صراحة)، وهي غير حساسة أصلاً (إنجازات لا خصوصية).
CREATE POLICY "Public badges read"      ON badges      FOR SELECT USING (true);
CREATE POLICY "Public user_badges read" ON user_badges FOR SELECT USING (true);
GRANT SELECT ON badges, user_badges TO anon, authenticated;
-- لا GRANT INSERT/UPDATE لأي دور على user_badges — الكتابة فقط عبر
-- award_badge_if_new() (SECURITY DEFINER) تحت، فمينفعش مستخدم يمنح نفسه شارة يدوياً

-- الرسائل: بس الطرفين (المرسل والمستقبل) يشوفوها
CREATE POLICY "Users see own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Recipient marks as read" ON messages
  FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
GRANT SELECT, UPDATE ON messages TO authenticated;
-- لا GRANT INSERT مباشر — الإرسال فقط عبر send_message() تحت (تتحقق
-- من عدم إرسال المستخدم لنفسه ومن عدم فراغ المحتوى قبل الإدخال)

-- الإشعارات: كل مستخدم يشوف/يعلّم كمقروء إشعاراته هو بس
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own as read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, UPDATE ON notifications TO authenticated;
-- لا GRANT INSERT — الإشعارات تتولّد فقط من award_badge_if_new()/send_message()

-- ============================================================
-- الدوال (RPC)
-- ============================================================

/* تمنح شارة لو أول مرة تُكسب فعلاً، وتنشئ إشعاراً بيها. تُستدعى من
   check_and_award_badges() فقط، مش مباشرة من الواجهة. */
CREATE OR REPLACE FUNCTION public.award_badge_if_new(p_user_id uuid, p_badge_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, p_badge_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN  -- FOUND = صحيح فقط لو الإدخال حصل فعلاً (مش تعارض)
    INSERT INTO notifications (user_id, type, title, body, related_id)
    SELECT p_user_id, 'badge', 'شارة جديدة! 🏅', title_ar, id
    FROM badges WHERE id = p_badge_id;
  END IF;
END;
$$;

/* تفحص كل شروط الشارات لمستخدم معيّن وتمنح المستحق منها. تُستدعى
   تلقائياً من record_stage_progress/track_share/track_app_time. */
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_count integer;
  v_share_count     integer;
  v_app_seconds     integer;
BEGIN
  SELECT count(*) INTO v_completed_count FROM user_progress
    WHERE user_id = p_user_id AND is_completed = true;
  SELECT share_count, app_seconds INTO v_share_count, v_app_seconds
    FROM profiles WHERE id = p_user_id;

  IF v_completed_count >= 10 THEN PERFORM award_badge_if_new(p_user_id, 'quiz_10'); END IF;
  IF v_completed_count >= 25 THEN PERFORM award_badge_if_new(p_user_id, 'quiz_25'); END IF;
  IF v_completed_count >= 25 THEN PERFORM award_badge_if_new(p_user_id, 'all_levels'); END IF;
  IF v_share_count     >= 1  THEN PERFORM award_badge_if_new(p_user_id, 'share_1'); END IF;
  IF v_app_seconds     >= 36000 THEN PERFORM award_badge_if_new(p_user_id, 'hours_10'); END IF;
  -- شارة 'ads_5': is_active=false حالياً، تُترك بدون تفعيل لحد ما تُبنى ميزة الإعلانات
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid) TO authenticated;

/* استدعاء من زر "شارك على واتساب" في الواجهة */
CREATE OR REPLACE FUNCTION public.track_share()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  UPDATE profiles SET share_count = share_count + 1 WHERE id = v_user_id;
  PERFORM check_and_award_badges(v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_share() TO authenticated;

/* استدعاء دوري (كل 60 ثانية تقريباً) من الواجهة طالما التطبيق مفتوح
   وفي المقدمة، عشان نراكم وقت استخدام حقيقي لشارة "10 ساعات". قيمة
   قصوى صغيرة لكل استدعاء (300 ثانية) كحماية بسيطة من قيم غير منطقية —
   ليست حماية كاملة من عبث متعمّد (خارج نطاق هذه المهمة). */
CREATE OR REPLACE FUNCTION public.track_app_time(p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_seconds < 0 OR p_seconds > 300 THEN RETURN; END IF;
  UPDATE profiles SET app_seconds = app_seconds + p_seconds WHERE id = v_user_id;
  PERFORM check_and_award_badges(v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_app_time(integer) TO authenticated;

/* إرسال رسالة + إنشاء إشعار للمستقبل في نفس الوقت (transaction واحدة).
   RPC بدل INSERT مباشر عشان نتحقق من عدم المراسلة الذاتية وعدم
   الفراغ، وننشئ الإشعار المرتبط تلقائياً. */
CREATE OR REPLACE FUNCTION public.send_message(p_recipient_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_sender_name text;
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

  INSERT INTO messages (sender_id, recipient_id, content)
  VALUES (v_sender_id, p_recipient_id, trim(p_content));

  SELECT username INTO v_sender_name FROM profiles WHERE id = v_sender_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (p_recipient_id, 'message', 'رسالة جديدة من ' || v_sender_name, trim(p_content), v_sender_id::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;

/* تحديث record_stage_progress (من migration 002) عشان تفحص الشارات
   تلقائياً بعد كل إتمام مرحلة — نفس المنطق السابق + سطر واحد إضافي */
CREATE OR REPLACE FUNCTION public.record_stage_progress(
  p_level_id integer,
  p_stage_id integer,
  p_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_old_score integer;
  v_delta     integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً لحفظ التقدم';
  END IF;

  SELECT best_score INTO v_old_score FROM user_progress
    WHERE user_id = v_user_id AND level_id = p_level_id AND stage_id = p_stage_id;
  v_old_score := COALESCE(v_old_score, 0);
  v_delta := GREATEST(p_score, v_old_score) - v_old_score;

  INSERT INTO user_progress (user_id, level_id, stage_id, is_completed, best_score, updated_at)
  VALUES (v_user_id, p_level_id, p_stage_id, true, GREATEST(p_score, v_old_score), now())
  ON CONFLICT (user_id, level_id, stage_id)
  DO UPDATE SET is_completed = true,
                best_score   = GREATEST(user_progress.best_score, p_score),
                updated_at   = now();

  IF v_delta > 0 THEN
    UPDATE profiles SET total_points = total_points + v_delta WHERE id = v_user_id;
  END IF;

  PERFORM check_and_award_badges(v_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_stage_progress(integer, integer, integer) TO authenticated;

-- ============================================================
-- 5) الحذف التلقائي بعد أسبوع (Messages + Notifications)
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
END;
$$;

COMMIT;

-- ============================================================
-- جدولة الحذف التلقائي — شغّل هذا الجزء مرة واحدة يدوياً من SQL Editor
-- (خارج BEGIN/COMMIT فوق عمداً، لأن pg_cron يحتاج الامتداد مفعّلاً أولاً)
-- ============================================================
-- الخطوة 1: فعّل الامتداد (مرة واحدة فقط):
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- الخطوة 2: جدولة التشغيل اليومي (الساعة 3 صباحاً بتوقيت UTC):
--   SELECT cron.schedule(
--     'delete-old-messages-notifications',
--     '0 3 * * *',
--     $$SELECT public.delete_old_messages_and_notifications();$$
--   );
--
-- راجع supabase/README.md وsupabase/functions/cleanup-old-messages/
-- لبديل Edge Function جاهز لو pg_cron غير متاح في خطة مشروعك على Supabase.
