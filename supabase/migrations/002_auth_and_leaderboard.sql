-- ============================================================
-- Mesori — المرحلة 3: تسجيل الدخول + قائمة متصدرين حقيقية
-- ============================================================
-- يُطبَّق هذا الملف بعد 001_schema.sql (لا يحذف أي جدول، فقط
-- يضيف/يعدّل).
--
-- يضيف:
-- 1) عمود onboarding_completed على profiles — لمعرفة هل المستخدم
--    اختار اسمه/عمره/شخصيته بعد التسجيل مباشرة أم لسه.
-- 2) Trigger على auth.users: بمجرد ما حد يسجّل حساب جديد (Supabase
--    Auth)، يتولّد له تلقائياً صف في profiles — بدل ما نعتمد على
--    الواجهة الأمامية تعمل INSERT بنفسها (أقل عرضة للأخطاء، ولو
--    فشل التسجيل من الواجهة لأي سبب، بروفايل المستخدم لسه هيتعمل).
-- 3) View باسم leaderboard: قائمة متصدرين حقيقية من profiles
--    مرتّبة حسب النقاط، بدون كشف أي عمود حساس (بدون age/country).
-- ============================================================

BEGIN;

-- ---------- 1) onboarding_completed ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- ---------- 2) إنشاء بروفايل تلقائي عند التسجيل ----------
/*
 * SECURITY DEFINER ضروري هنا: الدالة بتتنفّذ كجزء من عملية INSERT
 * على auth.users (جدول مُدار بالكامل من Supabase)، والمستخدم الجديد
 * نفسه لسه معندوش صلاحية INSERT على profiles في هذه اللحظة بالذات.
 * تشغيلها بصلاحيات مالك الدالة (postgres) يحل هذا مؤقتاً وبأمان
 * لأنها مقفولة على إدخال صف واحد فقط بمعرّف المستخدم الجديد بالظبط.
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, character)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), 'مكتشف'),
    'boy'
  )
  ON CONFLICT (id) DO NOTHING; -- لو حصل استدعاء مكرر لأي سبب، ما يفشلش
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 3) قائمة المتصدرين الحقيقية ----------
/*
 * View عادية (مش SECURITY DEFINER بشكل صريح — الـ Views في Postgres
 * تتنفّذ بصلاحيات مالكها افتراضياً، ومالكها هنا هو الدور اللي بيشغّل
 * هذا الملف في Supabase SQL Editor وعنده BYPASSRLS)، فبتـ"تخترق"
 * قيد RLS الصارم على profiles (كل مستخدم يرى صفّه فقط) عمداً، عشان
 * تعرض النقاط والاسم والشخصية لكل اللاعبين — بدون أي عمود حساس
 * زي age/country/created_at.
 */
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.character,
  p.total_points,
  COALESCE(MAX(up.level_id) FILTER (WHERE up.is_completed), 1) AS level_reached,
  RANK() OVER (ORDER BY p.total_points DESC, p.username ASC) AS rank
FROM public.profiles p
LEFT JOIN public.user_progress up ON up.user_id = p.id
WHERE p.onboarding_completed = true
GROUP BY p.id, p.username, p.character, p.total_points
ORDER BY p.total_points DESC, p.username ASC
LIMIT 50;

GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- ---------- 4) دالة آمنة لتسجيل إتمام مرحلة ----------
/*
 * بديل عن كتابة user_progress + تحديث profiles.total_points من
 * الواجهة مباشرة بخطوتين منفصلتين (فيه احتمال سباق/تعارض، ولو حصل
 * فشل بين الخطوتين تفضل البيانات غير متطابقة). هذه الدالة تعمل
 * الاثنين معاً في معاملة واحدة (transaction)، وتحسب فرق النقاط
 * (delta) بنفسها بدل ما تثق في رقم جاهز من العميل — لو المستخدم
 * أعاد مرحلة بنتيجة أقل من سابقتها، النقاط الكلية ما تتأثرش.
 *
 * ⚠️ هذه ليست الحماية الكاملة الموصوفة في "المرحلة 4" بـ
 * BACKEND_GUIDE.md (لسه مفيش تحقّق من إن p_score منطقي فعلاً
 * بمقارنته بعدد أسئلة المرحلة الحقيقي) — دي خطوة تالية مقصودة،
 * لكنها تمنع تضارب البيانات (data races) من الآن.
 */
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stage_progress(integer, integer, integer) TO authenticated;

COMMIT;
