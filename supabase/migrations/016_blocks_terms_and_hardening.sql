-- ============================================================
-- 016_blocks_terms_and_hardening.sql
-- ============================================================
-- 1) حظر اللاعبين (سياسة UGC في Google Play: لازم المستخدم يقدر يحظر
--    مستخدم تاني في أي ميزة رسائل). user_blocks جدول مقفول: القراءة لصاحب
--    الحظر بس، والكتابة عن طريق block_user / unblock_user فقط.
-- 2) موافقة على شروط الاستخدام قبل أول رسالة: profiles.terms_accepted_at
--    (بتتكتب عن طريق accept_terms فقط، مش من العميل مباشرة). send_message
--    بترفض 'TERMS_NOT_ACCEPTED' لو ما وافقش.
-- 3) send_message: فحص الحظر في الاتجاهين، وجود المستلم، وحد 30 رسالة/ساعة.
--    invite_friendly_match و search_users_by_username بيحترموا الحظر كمان.
-- 4) إغلاق صلاحيات (من تقرير Supabase security advisor):
--    - anon ما ينفعش ينفّذ أي دالة في public (كل التطبيق بيشتغل بعد تسجيل دخول).
--    - الدوال الداخلية (بتتنادى من دوال تانية SECURITY DEFINER أو triggers)
--      اتقفلت عن authenticated كمان. أخطرها finalize_match_as_forfeit(match,
--      player) اللي كانت بتسمح لأي مستخدم يفرّط في مباراة لاعب تاني، و
--      award_badge_if_new(user, badge) اللي كانت بتدّي أي شارة لأي حساب.
--    - profiles: العميل يقدر يعدّل أعمدة الملف الشخصي بس (مش النقاط ولا
--      التصنيف ولا is_bot ولا terms_*)، ولا يعمل INSERT/DELETE مباشر.
-- ============================================================

-- ------------------------------------------------------------
-- 1) user_blocks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_blocks FROM anon, authenticated;
GRANT SELECT ON public.user_blocks TO authenticated;
DROP POLICY IF EXISTS "Users see own blocks" ON public.user_blocks;
CREATE POLICY "Users see own blocks" ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

-- ------------------------------------------------------------
-- 2) أعمدة الموافقة على الشروط
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

CREATE OR REPLACE FUNCTION public.accept_terms(p_version text DEFAULT '2026-10-03')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  UPDATE profiles
  SET terms_accepted_at = now(),
      terms_version = left(coalesce(nullif(trim(p_version), ''), '2026-10-03'), 32)
  WHERE id = auth.uid();
END;
$$;

-- ------------------------------------------------------------
-- 3) حظر / إلغاء حظر / قائمة المحظورين
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF v_me = p_user_id THEN
    RAISE EXCEPTION 'مينفعش تحظر نفسك';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_bot = false) THEN
    RAISE EXCEPTION 'اللاعب غير موجود';
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (v_me, p_user_id)
  ON CONFLICT DO NOTHING;

  -- شيل رسائل ودعوات اللاعب المحظور من إشعاراتي
  DELETE FROM notifications
  WHERE user_id = v_me
    AND related_id = p_user_id::text
    AND type IN ('message', 'match_invite');

  -- دعوات التحدي المعلّقة بينا (في الاتجاهين) تتلغي
  UPDATE matches SET status = 'declined'
  WHERE mode = 'friendly' AND status = 'pending'
    AND ((player_1_id = v_me AND player_2_id = p_user_id)
      OR (player_1_id = p_user_id AND player_2_id = v_me));
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  DELETE FROM user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE(id uuid, username text, avatar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.character AS avatar
  FROM user_blocks b
  JOIN profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
END;
$$;

-- هل فيه حظر بين اتنين؟ ('me' = أنا حاظر، 'them' = هو حاظرني، NULL = لا)
CREATE OR REPLACE FUNCTION public._block_direction(p_me uuid, p_other uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = p_me AND blocked_id = p_other) THEN 'me'
    WHEN EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = p_other AND blocked_id = p_me) THEN 'them'
    ELSE NULL
  END;
$$;

-- ------------------------------------------------------------
-- 4) send_message: شروط + حظر + حد معدّل
-- ------------------------------------------------------------
-- الأخطاء بأكواد ثابتة عشان الواجهة تعرضها بالعربي:
--   TERMS_NOT_ACCEPTED | MESSAGE_BLOCKED_BY_ME | MESSAGE_UNAVAILABLE |
--   RATE_LIMITED | CONTACT_INFO_<TYPE>
-- MESSAGE_UNAVAILABLE (هو حاظرني) رسالة محايدة عمداً: ما نكشفش للمحظور إنه محظور.
CREATE OR REPLACE FUNCTION public.send_message(p_recipient_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_sender_name text;
  v_terms       timestamptz;
  v_dir         text;
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
  IF length(p_content) > 500 THEN
    RAISE EXCEPTION 'الرسالة طويلة';
  END IF;

  SELECT username, terms_accepted_at INTO v_sender_name, v_terms
  FROM profiles WHERE id = v_sender_id;
  IF v_terms IS NULL THEN
    RAISE EXCEPTION 'TERMS_NOT_ACCEPTED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_recipient_id AND is_bot = false) THEN
    RAISE EXCEPTION 'اللاعب غير موجود';
  END IF;

  v_dir := public._block_direction(v_sender_id, p_recipient_id);
  IF v_dir = 'me' THEN
    RAISE EXCEPTION 'MESSAGE_BLOCKED_BY_ME';
  ELSIF v_dir = 'them' THEN
    RAISE EXCEPTION 'MESSAGE_UNAVAILABLE';
  END IF;

  IF (SELECT count(*) FROM messages
      WHERE sender_id = v_sender_id AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
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

  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (p_recipient_id, 'message', 'رسالة جديدة من ' || v_sender_name, trim(p_content), v_sender_id::text);
END;
$$;

-- ------------------------------------------------------------
-- invite_friendly_match: نفس المنطق + احترام الحظر
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_friendly_match(p_opponent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_match_id uuid;
  v_questions jsonb;
  v_inviter_name text;
  v_dir text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF v_user_id = p_opponent_id THEN
    RAISE EXCEPTION 'مينفعش تدعو نفسك';
  END IF;

  v_dir := public._block_direction(v_user_id, p_opponent_id);
  IF v_dir = 'me' THEN
    RAISE EXCEPTION 'MESSAGE_BLOCKED_BY_ME';
  ELSIF v_dir = 'them' THEN
    RAISE EXCEPTION 'MESSAGE_UNAVAILABLE';
  END IF;

  -- فيه دعوة/مباراة معلّقة بالفعل بين نفس الاثنين؟ رجّعها بدل تكرار
  SELECT id INTO v_match_id FROM matches
    WHERE mode = 'friendly' AND status IN ('pending', 'in_progress')
      AND ((player_1_id = v_user_id AND player_2_id = p_opponent_id)
        OR (player_1_id = p_opponent_id AND player_2_id = v_user_id))
    LIMIT 1;
  IF v_match_id IS NOT NULL THEN
    RETURN v_match_id;
  END IF;

  v_questions := pick_random_match_questions();
  INSERT INTO matches (mode, player_1_id, player_2_id, question_ids, status)
  VALUES ('friendly', v_user_id, p_opponent_id, v_questions, 'pending')
  RETURNING id INTO v_match_id;

  SELECT username INTO v_inviter_name FROM profiles WHERE id = v_user_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (p_opponent_id, 'match_invite', 'دعوة مباراة من ' || v_inviter_name,
          'اضغط للقبول والبدء فوراً', v_match_id::text);

  RETURN v_match_id;
END;
$$;

-- ------------------------------------------------------------
-- البحث عن لاعبين: يستثني المحظورين في الاتجاهين
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users_by_username(p_query text)
RETURNS TABLE(id uuid, username text, avatar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.character AS avatar
  FROM profiles p
  WHERE p.onboarding_completed = true
    AND p.id <> auth.uid()
    AND p.username ILIKE '%' || trim(p_query) || '%'
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
  ORDER BY p.username
  LIMIT 10;
END;
$$;

-- ------------------------------------------------------------
-- 5) إغلاق الصلاحيات
-- ------------------------------------------------------------
-- (أ) anon: ولا دالة في public (كل التطبيق بيشتغل بعد تسجيل دخول)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    -- بنثبّت صلاحية authenticated و service_role صراحةً (بعد شيل PUBLIC)
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- (ب) دوال داخلية: بتتنادى من دوال SECURITY DEFINER تانية أو triggers بس
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND p.proname IN (
        'award_badge_if_new', 'check_and_award_badges', 'finalize_match',
        'finalize_match_as_forfeit', 'finalize_quiz_stage', 'advance_match_round',
        'resolve_match_staleness', 'void_match', 'sync_leaderboard_stats',
        'handle_new_user', 'rls_auto_enable', 'pick_random_match_questions',
        'delete_old_messages_and_notifications', 'enforce_min_age',
        '_contact_base', '_contact_digit_stream', '_contact_digit_count',
        'detect_contact_info', '_block_direction', 'prepare_account_deletion'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- (ج) دوال يستخدمها العميل: authenticated بس
GRANT EXECUTE ON FUNCTION public.accept_terms(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_blocked_users()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_friendly_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_by_username(text) TO authenticated;

-- (د) search_path ثابت للدالة المتبقية
ALTER FUNCTION public.shuffled_indices SET search_path = public;

-- (هـ) profiles: تعديل أعمدة الملف الشخصي بس، ولا INSERT/DELETE مباشر
-- (النقاط/التصنيف/is_bot/terms_* بتتغيّر من دوال السيرفر بس)
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (username, "character", age, country, country_flag, gender, onboarding_completed)
  ON public.profiles TO authenticated;
