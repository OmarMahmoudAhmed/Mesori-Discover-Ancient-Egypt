-- ============================================================
-- 015_account_deletion_and_min_age.sql
-- ============================================================
-- 1) حذف الحساب ما يمسحش مباريات الخصم:
--    كان matches.player_1_id / player_2_id = ON DELETE CASCADE، فحذف حساب
--    لاعب كان بيمسح كل مبارياته من تاريخ خصمه كمان (وكانت نتيجتها اتحسبت
--    فعلاً في تصنيف الخصم). دلوقتي: SET NULL على الأعمدة التلاتة
--    (player_1_id / player_2_id / winner_id) والأعمدة بقت nullable —
--    صف المباراة بيفضل لخصمه، والطرف المحذوف بيبقى NULL (حساب محذوف).
--    الدوال الموجودة بتتعامل مع NULL بأمان (اتفحصت): get_current_match_state
--    بترجّع opponent_username = NULL، وباقي الدوال شغّالة على in_progress بس.
--
-- 2) prepare_account_deletion(uid): بتتنادى من Edge Function قبل الحذف:
--    - مباريات 1 ضد 1 الجارية → انسحاب (finalize_match_as_forfeit):
--      الخصم بياخد الفوز بنفس حساب أي انسحاب عادي.
--    - مباريات البوت (جارية أو منتهية) → تتمسح (مفيش خصم بشري يستفيد).
--    - دعوات التحدي المعلّقة → declined.
--    ممنوعة على anon/authenticated (service_role بس) — لأنها SECURITY DEFINER
--    وتقدر تنهي مباريات أي لاعب.
--
-- 3) حد أدنى للسن 13 على مستوى السيرفر (Trigger، مش CHECK): CHECK NOT VALID
--    كان هيتفحص على أي UPDATE لصف قديم (حتى تحديث rating) وبالتالي يكسر
--    اللعب لأي حساب قديم عمره < 13. الـ Trigger بيفحص بس عند INSERT أو
--    تغيير age أو تفعيل onboarding_completed.
--
-- 4) التنظيف الليلي (الـ cron الموجود daily-cleanup-and-keepalive الساعة 03:00
--    بينادي delete_old_messages_and_notifications() أصلاً — مفيش جدولة جديدة
--    مطلوبة): بنوسّع الدالة لتشمل البلاغات > 180 يوم، ومباريات
--    اللاعبين المحذوفين اللي ملهاش قيمة.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) matches: SET NULL بدل CASCADE / NO ACTION
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, a.attname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.matches'::regclass
      AND c.contype = 'f'
      AND a.attname IN ('player_1_id', 'player_2_id', 'winner_id')
  LOOP
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', r.conname);
    EXECUTE format(
      'ALTER TABLE public.matches ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.conname, r.attname
    );
  END LOOP;
END $$;

ALTER TABLE public.matches ALTER COLUMN player_1_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN player_2_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 2) تجهيز حذف الحساب
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  -- 1 ضد 1 جارية ضد لاعب حقيقي → انسحاب (الخصم يفوز)
  FOR m IN
    SELECT id FROM matches
    WHERE status = 'in_progress' AND NOT is_bot_match
      AND (player_1_id = p_user_id OR player_2_id = p_user_id)
  LOOP
    PERFORM finalize_match_as_forfeit(m.id, p_user_id);
  END LOOP;

  -- دعوات تحدي معلّقة → اترفضت
  UPDATE matches SET status = 'declined'
  WHERE status = 'pending'
    AND (player_1_id = p_user_id OR player_2_id = p_user_id);

  -- مباريات البوت: مفيش خصم بشري، تتمسح (match_answers عليها CASCADE)
  DELETE FROM matches
  WHERE is_bot_match
    AND (player_1_id = p_user_id OR player_2_id = p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;

-- ------------------------------------------------------------
-- 3) حد أدنى للسن 13 (سيرفر)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_bot, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.age IS NOT NULL AND NEW.age < 13
     AND (TG_OP = 'INSERT' OR NEW.age IS DISTINCT FROM OLD.age) THEN
    RAISE EXCEPTION 'AGE_BELOW_MINIMUM';
  END IF;

  IF NEW.onboarding_completed
     AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.onboarding_completed, false))
     AND (NEW.age IS NULL OR NEW.age < 13) THEN
    RAISE EXCEPTION 'AGE_BELOW_MINIMUM';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_min_age_trigger ON public.profiles;
CREATE TRIGGER enforce_min_age_trigger
  BEFORE INSERT OR UPDATE OF age, onboarding_completed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_age();

-- ------------------------------------------------------------
-- 4) التنظيف الليلي (نفس اسم الدالة اللي الـ cron بينادي عليها)
-- ------------------------------------------------------------
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

  -- مباريات ملهاش أي طرف بشري باقي (الاتنين اتحذفوا)
  DELETE FROM matches
  WHERE player_1_id IS NULL AND player_2_id IS NULL;

  -- دعوات/مباريات مرفوضة أو متروكة بعد حذف أحد الطرفين: مفيش تاريخ يستاهل يتحفظ
  DELETE FROM matches
  WHERE (player_1_id IS NULL OR player_2_id IS NULL)
    AND status IN ('pending', 'declined', 'abandoned')
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

COMMIT;
