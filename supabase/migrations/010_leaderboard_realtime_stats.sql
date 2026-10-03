-- ============================================================
-- 010_leaderboard_realtime_stats.sql
-- ------------------------------------------------------------
-- ملحوظة: طُبّق هذا التغيير مباشرة على المشروع الحي بالفعل
-- (nblmltwjkqlcixguiioq) بتاريخ 2026-08-27. هذا الملف موجود عشان
-- يبقى متسجل في تاريخ الـ migrations بتاع الريبو (نفس أسلوب
-- 009_notifications_realtime.sql).
--
-- السبب: عايزين نعرف لحظياً (Realtime) لما ترتيب أي لاعب يتغيّر،
-- عشان نظهر تأثير "تخطيت حد / حد تخطاك" وانت واقف في صفحة
-- الليدربورد فعلاً. لكن الاشتراك المباشر في تغييرات profiles
-- مايصلحش: السياسة الوحيدة عليه هي (auth.uid() = id) — يعني
-- Realtime (اللي بيطبّق RLS على postgres_changes) هيوصّل لكل
-- مستخدم تغييرات صفّه هو بس، مش تغييرات أي لاعب تاني. وتوسيع
-- RLS على profiles نفسه كان هيسرّب أعمدة حساسة (age, country,
-- gender, app_seconds, rewarded_ads_watched, vs_wins/losses/draws)
-- لكل المستخدمين — عكس اللي view الـ leaderboard مصمّم عمداً
-- يتفاداه.
--
-- الحل: جدول leaderboard_stats — نسخة ضيّقة فيها بس الأعمدة
-- العلنية أصلاً (id/username/character/total_points، هي نفسها
-- اللي view الـ leaderboard بيعرضها للجميع)، بيتحدّث تلقائياً عبر
-- trigger على profiles، قابل للقراءة من الجميع، ومسجّل في
-- publication الـ Realtime بدل profiles نفسه.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leaderboard_stats (
  id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  username     text NOT NULL,
  character    text,
  total_points integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read leaderboard stats" ON public.leaderboard_stats;
CREATE POLICY "Anyone can read leaderboard stats"
  ON public.leaderboard_stats FOR SELECT
  USING (true);
-- عمداً: مفيش policy لـ INSERT/UPDATE/DELETE لأي دور عادي — الكتابة
-- الوحيدة المسموحة هي عبر trigger function التحت (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.sync_leaderboard_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_completed THEN
    INSERT INTO public.leaderboard_stats (id, username, character, total_points, updated_at)
    VALUES (NEW.id, NEW.username, NEW.character, NEW.total_points, now())
    ON CONFLICT (id) DO UPDATE
      SET username     = EXCLUDED.username,
          character    = EXCLUDED.character,
          total_points = EXCLUDED.total_points,
          updated_at   = now();
  ELSE
    DELETE FROM public.leaderboard_stats WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_leaderboard_stats_trigger ON public.profiles;
CREATE TRIGGER sync_leaderboard_stats_trigger
  AFTER INSERT OR UPDATE OF total_points, username, character, onboarding_completed
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_leaderboard_stats();

-- تعبئة أولى (نفس فلتر leaderboard view: onboarding_completed = true فقط)
INSERT INTO public.leaderboard_stats (id, username, character, total_points, updated_at)
SELECT id, username, character, total_points, now()
FROM public.profiles
WHERE onboarding_completed = true
ON CONFLICT (id) DO UPDATE
  SET username     = EXCLUDED.username,
      character    = EXCLUDED.character,
      total_points = EXCLUDED.total_points,
      updated_at   = now();

ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_stats;
