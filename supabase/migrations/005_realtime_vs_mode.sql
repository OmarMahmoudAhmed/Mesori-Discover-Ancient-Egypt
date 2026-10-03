-- ============================================================
-- Mesori — 1 ضد 1 مزامنة فورية (Timer مُرسَل من السيرفر)
-- ============================================================
-- يُطبَّق بعد 004.
-- التغييرات الرئيسية:
-- 1) أعمدة جديدة في matches: current_question_index,
--    question_started_at, question_time_limit_seconds
--    (Timer مُرسَل من السيرفر بدل العد التنازلي المحلي)
-- 2) time_taken_ms في match_answers (لحساب مكافأة السرعة)
-- 3) get_current_match_state(): دالة موحدة تجلب كل بيانات المباراة
--    الحالية (سؤال + حالة الإجابة + معلومات الانتهاء)
-- 4) submit_match_answer() تحوّلت: التحقق من فهرس السؤال +
--    استدعاء advance_match_round عند إجابة اللاعبين الاثنين
-- 5) advance_match_round(): التقدم التلقائي (compare-and-swap آمن)
-- 6) finalize_match() أُضيفت لها مكافأة السرعة (speed bonus)
-- 7) find_or_create_match() + accept_friendly_match() يضبطان
--    current_question_index + question_started_at فوراً
-- ============================================================

BEGIN;

-- ============================================================
-- 1) أعمدة جديدة
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_question_index    integer NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS question_started_at       timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS question_time_limit_seconds integer NOT NULL DEFAULT 15;

ALTER TABLE match_answers ADD COLUMN IF NOT EXISTS time_taken_ms integer;

-- ============================================================
-- 2) get_current_match_state — الدالة الموحّدة لجلب حالة المباراة
-- ============================================================
/*
 * بدل ما العميل يستدعي get_match_question + يسألك "هل الخصم جاوب؟"
 * كل في طلب منفصل، الدالة دي بتجيب كل حاجة في طلب واحد:
 * السؤال الحالي + هل أنا جاوبت + هل الخصم جاوب + معلومات الانتهاء.
 * ده بيقلل عدد الاتصالات وبيخلي التزامن أدق (كل البيانات من
 * نفس اللحظة في السيرفر).
 */
CREATE OR REPLACE FUNCTION public.get_current_match_state(p_match_id uuid)
RETURNS TABLE (
  status                      text,
  current_question_index      integer,
  question_started_at         timestamptz,
  question_time_limit_seconds integer,
  total_questions             integer,
  question                    text,
  options                     jsonb,
  my_answered                 boolean,
  opponent_answered           boolean,
  winner_id                   uuid,
  player_1_id                 uuid,
  player_2_id                 uuid,
  player_1_rating_change      integer,
  player_2_rating_change      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_ref jsonb;
  v_opponent_id uuid;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  v_opponent_id := CASE WHEN v_match.player_1_id = v_user_id THEN v_match.player_2_id ELSE v_match.player_1_id END;
  v_ref := v_match.question_ids -> v_match.current_question_index;

  RETURN QUERY
  SELECT
    v_match.status,
    v_match.current_question_index,
    v_match.question_started_at,
    v_match.question_time_limit_seconds,
    jsonb_array_length(v_match.question_ids),
    q.question,
    q.options,
    EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_user_id AND question_index = v_match.current_question_index),
    EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_opponent_id AND question_index = v_match.current_question_index),
    v_match.winner_id,
    v_match.player_1_id,
    v_match.player_2_id,
    v_match.player_1_rating_change,
    v_match.player_2_rating_change
  FROM questions q
  WHERE v_ref IS NOT NULL
    AND q.level_id = (v_ref->>'level_id')::integer
    AND q.stage_id = (v_ref->>'stage_id')::integer
    AND q.id       = (v_ref->>'id')::integer;

  -- المباراة خلصت بالفعل (لسه سؤال فاضي) — ارجّع الحالة بدون سؤال
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_match.status, v_match.current_question_index, v_match.question_started_at,
      v_match.question_time_limit_seconds, jsonb_array_length(v_match.question_ids),
      NULL::text, NULL::jsonb, false, false,
      v_match.winner_id, v_match.player_1_id, v_match.player_2_id,
      v_match.player_1_rating_change, v_match.player_2_rating_change;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_match_state(uuid) TO authenticated;

-- ============================================================
-- 3) find_or_create_match — يضبط current_question_index + question_started_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_or_create_match()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_opponent_id uuid;
  v_match_id uuid;
  v_questions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;

  -- عنده مباراة شغالة بالفعل؟ رجّعها
  SELECT id INTO v_match_id FROM matches
    WHERE (player_1_id = v_user_id OR player_2_id = v_user_id)
      AND status = 'in_progress'
    LIMIT 1;
  IF v_match_id IS NOT NULL THEN
    RETURN v_match_id;
  END IF;

  -- دوّر على خصم منتظر
  SELECT player_id INTO v_opponent_id FROM matchmaking_queue
    WHERE player_id <> v_user_id
    ORDER BY joined_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF v_opponent_id IS NULL THEN
    INSERT INTO matchmaking_queue (player_id) VALUES (v_user_id)
      ON CONFLICT (player_id) DO UPDATE SET joined_at = now();
    RETURN NULL;
  END IF;

  v_questions := pick_random_match_questions();
  INSERT INTO matches (mode, player_1_id, player_2_id, question_ids, status, started_at, current_question_index, question_started_at)
  VALUES ('random', v_opponent_id, v_user_id, v_questions, 'in_progress', now(), 0, now())
  RETURNING id INTO v_match_id;

  DELETE FROM matchmaking_queue WHERE player_id IN (v_user_id, v_opponent_id);

  RETURN v_match_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_or_create_match() TO authenticated;

-- ============================================================
-- 4) accept_friendly_match — يبدأ العد التنازلي فوراً عند القبول
-- ============================================================
/*
 * التغيير الرئيسي عن 004: بدل ما ي公平ّض status بس، دلوقتي
 * بيبدأ السؤال الأول فوراً (current_question_index=0 + question_started_at).
 * ده معناه إن الـ timer يبدأ مباشرة بعد القبول، والمستخدمين
 * الاتنين يشوفوا السؤال في نفس اللحظة تقريباً.
 */
CREATE OR REPLACE FUNCTION public.accept_friendly_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE matches SET status = 'in_progress', started_at = now(),
                      current_question_index = 0, question_started_at = now()
  WHERE id = p_match_id AND player_2_id = v_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدعوة دي مش موجودة أو مش ليك أو اتقبلت/اتلغت قبل كده';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friendly_match(uuid) TO authenticated;

-- ============================================================
-- 5) submit_match_answer — يتحقق من فهرس السؤال + يaciTrack الوقت
--    + يستدعي advance_match_round عند إجابة اللاعبين الاثنين
-- ============================================================
/*
 * التغييرات الرئيسية عن 004:
 * a) التحقق من فهرس السؤال (prevent stale answer): لو العميل
 *    بيبعت إجابة على سؤال قديم (مثلاً السيرفر خلّص السؤال قبل
 *    ما يوصلك)، الرد بيرفض الإجابة.
 * b) تسجيل time_taken_ms (من question_started_at) لحساب مكافأة السرعة.
 * c) بدل ما يتحقق إن اللاعبين خلصوا كل الأسئلة (count-based)،
 *    بيستدعي advance_match_round لو الاتنين جاوبوا السؤال الحالي.
 */
CREATE OR REPLACE FUNCTION public.submit_match_answer(
  p_match_id uuid,
  p_question_index integer,
  p_selected_index integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_ref jsonb;
  v_correct_index integer;
  v_is_correct boolean;
  v_time_taken_ms integer;
  v_p1_answered boolean;
  v_p2_answered boolean;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;
  IF v_match.status <> 'in_progress' THEN
    RAISE EXCEPTION 'المباراة دي مش شغالة حالياً';
  END IF;

  -- التحقق من فهرس السؤال: لو الإجابة جاية على سؤال قديم (بعد ما السيرفر خلّصه)، ارفضها
  IF p_question_index <> v_match.current_question_index THEN
    RAISE EXCEPTION 'السؤال ده مش مفتوح الحين (السؤال المتاح غير كده)';
  END IF;

  v_ref := v_match.question_ids -> p_question_index;
  SELECT correct_index INTO v_correct_index FROM questions
    WHERE level_id = (v_ref->>'level_id')::integer
      AND stage_id = (v_ref->>'stage_id')::integer
      AND id       = (v_ref->>'id')::integer;

  v_is_correct := (v_correct_index = p_selected_index);
  v_time_taken_ms := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_match.question_started_at)) * 1000)::integer;

  INSERT INTO match_answers (match_id, player_id, question_index, selected_index, is_correct, time_taken_ms)
  VALUES (p_match_id, v_user_id, p_question_index, p_selected_index, v_is_correct, v_time_taken_ms)
  ON CONFLICT (match_id, player_id, question_index) DO NOTHING;

  -- لو الاتنين جاوبوا السؤال الحالي، قدّم للسؤال الجاي
  v_p1_answered := EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND question_index = p_question_index);
  v_p2_answered := EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id AND question_index = p_question_index);
  IF v_p1_answered AND v_p2_answered THEN
    PERFORM advance_match_round(p_match_id, p_question_index);
  END IF;

  RETURN v_is_correct;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_match_answer(uuid, integer, integer) TO authenticated;

-- ============================================================
-- 6) advance_match_round — التقدم التلقائي للسؤال التالي
-- ============================================================
/*
 * بدل ما كل عميل ي exceededّ自行 عد تنازلي ويتخمن امتى ينتقل،
 * السيرفر هو اللي بيقرر: لو الاتنين جاوبوا، نقلّ السؤال فوراً.
 * 마지막 سؤال (آخر سؤال) → finalize_match.
 *
 * مُحمّى من the-stale-advance problem (simultaneous timer expiry):
 * لو اللاعبين الاتنين جاوبوا ودالة advance_match_round اتاستدعت
 * مرتين (من سيرفر فرعي متعدد أو Realtime webhook)، الاستدعاء
 * التاني بيرجع فاضي لأن WHERE current_question_index = p_expected_index
 * مش هيتطابق تاني (العدّاد اتزوّد بالفعل).atch-and-swap.
 */
CREATE OR REPLACE FUNCTION public.advance_match_round(p_match_id uuid, p_expected_index integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL THEN RETURN; END IF;

  IF p_expected_index + 1 >= jsonb_array_length(v_match.question_ids) THEN
    -- آخر سؤال: أقفل المباراة (finalize_match بتحسّن الحالة لـ in_progress الحاضر)
    PERFORM finalize_match(p_match_id);
  ELSE
    UPDATE matches
      SET current_question_index = p_expected_index + 1, question_started_at = now()
      WHERE id = p_match_id AND current_question_index = p_expected_index AND status = 'in_progress';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.advance_match_round(uuid, integer) TO authenticated;

-- ============================================================
-- 7) finalize_match — مُحدّثة مع مكافأة السرعة
-- ============================================================
/*
 * مقارنة بـ 004:
 * - اتنزعت match_answers.time_taken_ms (لو slug مش موجود)، وحسابت
 *   speed_bonus لكل لاعب: مجموع (الوقت المتبقي / الوقت الكلي) * max_bonus
 *   لكل إجابة صحيحة.
 * - النقاط = (عدد الصح * 4) + speed_bonus + (30 لو فاز).
 * - tiebreaker تغيّر من "آخر إجابة أسرع" إلى speed_bonus فقط
 *   (منطقي أكdar لـ 5 أسئلة: الأكتر سرعة في الإجابات الصحيحة يكسب).
 */
CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_p1_correct integer; v_p2_correct integer;
  v_p1_speed_bonus integer; v_p2_speed_bonus integer;
  v_winner_id uuid;
  v_p1_rating integer; v_p2_rating integer;
  v_p1_expected numeric; v_p2_expected numeric;
  v_p1_actual numeric; v_p2_actual numeric;
  v_p1_change integer; v_p2_change integer;
  v_win_bonus constant integer := 30;
  v_points_per_q constant integer := 4;
  v_max_speed_bonus constant integer := 3; -- أقصى مكافأة سرعة لكل سؤال صحيح
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE is_correct) INTO v_p1_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id;
  SELECT count(*) FILTER (WHERE is_correct) INTO v_p2_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id;

  -- مكافأة السرعة: الأكتر سرعة في الإجابات الصحيحة يكسب نقاط إضافية
  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p1_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND is_correct;
  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p2_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id AND is_correct;

  -- تحديد الفائز: الأكتر صح، وعند المساواة: الأعلى speed_bonus
  IF v_p1_correct > v_p2_correct THEN v_winner_id := v_match.player_1_id;
  ELSIF v_p2_correct > v_p1_correct THEN v_winner_id := v_match.player_2_id;
  ELSE v_winner_id := NULL;
  END IF;

  SELECT rating INTO v_p1_rating FROM profiles WHERE id = v_match.player_1_id;
  SELECT rating INTO v_p2_rating FROM profiles WHERE id = v_match.player_2_id;
  v_p1_expected := 1.0 / (1.0 + power(10.0, (v_p2_rating - v_p1_rating) / 400.0));
  v_p2_expected := 1.0 - v_p1_expected;
  v_p1_actual := CASE WHEN v_winner_id = v_match.player_1_id THEN 1.0 WHEN v_winner_id IS NULL THEN 0.5 ELSE 0.0 END;
  v_p2_actual := 1.0 - v_p1_actual;
  v_p1_change := round(32 * (v_p1_actual - v_p1_expected));
  v_p2_change := round(32 * (v_p2_actual - v_p2_expected));

  UPDATE profiles SET
    rating = rating + v_p1_change,
    total_points = total_points + (v_p1_correct * v_points_per_q) + v_p1_speed_bonus + (CASE WHEN v_winner_id = v_match.player_1_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
    vs_draws  = vs_draws  + (CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END)
  WHERE id = v_match.player_1_id;

  UPDATE profiles SET
    rating = rating + v_p2_change,
    total_points = total_points + (v_p2_correct * v_points_per_q) + v_p2_speed_bonus + (CASE WHEN v_winner_id = v_match.player_2_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
    vs_draws  = vs_draws  + (CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END)
  WHERE id = v_match.player_2_id;

  UPDATE matches SET
    status = 'finished', winner_id = v_winner_id,
    player_1_rating_change = v_p1_change, player_2_rating_change = v_p2_change,
    finished_at = now()
  WHERE id = p_match_id;

  INSERT INTO notifications (user_id, type, title, body, related_id) VALUES
    (v_match.player_1_id, 'match_result',
     CASE WHEN v_winner_id = v_match.player_1_id THEN 'فزت في المباراة! 🏆' WHEN v_winner_id IS NULL THEN 'تعادلت في المباراة' ELSE 'خسرت المباراة' END,
     format('%s صح من %s، تغيّر التصنيف: %s%s', v_p1_correct, jsonb_array_length(v_match.question_ids), CASE WHEN v_p1_change >= 0 THEN '+' ELSE '' END, v_p1_change),
     p_match_id::text),
    (v_match.player_2_id, 'match_result',
     CASE WHEN v_winner_id = v_match.player_2_id THEN 'فزت في المباراة! 🏆' WHEN v_winner_id IS NULL THEN 'تعادلت في المباراة' ELSE 'خسرت المباراة' END,
     format('%s صح من %s، تغيّر التصنيف: %s%s', v_p2_correct, jsonb_array_length(v_match.question_ids), CASE WHEN v_p2_change >= 0 THEN '+' ELSE '' END, v_p2_change),
     p_match_id::text);
END;
$$;

COMMIT;
