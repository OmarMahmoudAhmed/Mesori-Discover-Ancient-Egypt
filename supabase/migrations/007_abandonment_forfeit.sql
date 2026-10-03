-- ============================================================
-- Mesori — انسحاب/عدم نشاط تلقائي (30 ثانية) + دعم واجهة المبارزة
-- ============================================================
-- يُطبَّق بعد 001-006.
--
-- ## الفرق بين "اللي انت طالبه" و"اللي كان موجود" ##
-- كان فيه فعلاً forfeit_abandoned_match() من قبل، لكنها:
-- 1) عتبتها 5 دقايق مش 30 ثانية
-- 2) يدوية بالكامل (اللاعب لازم يستدعيها بنفسه) ومش متوصّلة بأي
--    زرار في الواجهة أصلاً (dead code — اتأكدت بالبحث في كل src/)
-- 3) بتحسب "آخر نشاط" من إجابات الطرفين مع بعض مش كل لاعب لوحده —
--    فلو أنا فاضل بجاوب، عدّاد النشاط فاضل يتجدد بإجاباتي أنا،
--    ومستحيل عملياً إني أعلن انسحاب خصمي حتى لو فعلاً مختفي من
--    ساعتين، لأن نشاطي الشخصي بيغطي عليه
-- 4) مفيهاش أي تأثير على التصنيف/النقاط، مجرد فوز/خسارة عدّاد بسيط
--
-- المهاجرة دي بتضيف آلية تانية تماماً: لكل لاعب عمود last_seen
-- خاص بيه، الكلاينت بيحدّثه كل ~8 ثواني طول ما هو فاتح شاشة
-- المباراة وطول ما التطبيق في المقدمة (مش في الخلفية). لو لاعب
-- فضل عمود last_seen بتاعه أكتر من 30 ثانية من غير تحديث (أو ما
-- بعتش أي heartbeat من الأساس بعد بداية المباراة)، المباراة
-- بتتقفل تلقائياً كخسارة له، بنفس حساب النقاط/التصنيف بتاع نهاية
-- مباراة عادية — مش مجرد عدّاد فوز/خسارة فاضي.
--
-- الفحص نفسه بيحصل جوه get_current_match_state() (تحديث DROP+CREATE
-- تاني لتغيّر شكل RETURNS TABLE) — بيشتغل كـ side effect لأنها أصلاً
-- بتتنادى باستمرار من أي عميل لسه فاتح المباراة، فمحتجناش cron job
-- منفصل أو Edge Function خلفية.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) أعمدة جديدة
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_1_last_seen timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_2_last_seen timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason text CHECK (end_reason IN ('completed', 'forfeit'));

-- ============================================================
-- 2) touch_match_presence — نبضة حياة خفيفة، الكلاينت بينادّيها
--    بشكل دوري طول ما هو فاتح شاشة مباراة شغالة
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_match_presence(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE matches SET player_1_last_seen = now()
    WHERE id = p_match_id AND player_1_id = v_user_id AND status = 'in_progress';
  UPDATE matches SET player_2_last_seen = now()
    WHERE id = p_match_id AND player_2_id = v_user_id AND status = 'in_progress';
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_match_presence(uuid) TO authenticated;

-- ============================================================
-- 3) finalize_match_as_forfeit — نفس حساب finalize_match بالظبط
--    (صح/سرعة/ELO) لكن الفايز مفروض بدل ما يتحسب من المقارنة،
--    وبتحط end_reason = 'forfeit' للتفرقة في الواجهة
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_match_as_forfeit(p_match_id uuid, p_forfeiting_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_winner_id uuid;
  v_p1_correct integer; v_p2_correct integer;
  v_p1_speed_bonus integer; v_p2_speed_bonus integer;
  v_p1_rating integer; v_p2_rating integer;
  v_p1_expected numeric; v_p2_expected numeric;
  v_p1_actual numeric; v_p2_actual numeric;
  v_p1_change integer; v_p2_change integer;
  v_win_bonus constant integer := 30;
  v_points_per_q constant integer := 4;
  v_max_speed_bonus constant integer := 3;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL OR v_match.is_bot_match THEN RETURN; END IF; -- مفيش انسحاب ضد بوت أصلاً

  v_winner_id := CASE WHEN p_forfeiting_player_id = v_match.player_1_id THEN v_match.player_2_id ELSE v_match.player_1_id END;

  SELECT count(*) FILTER (WHERE is_correct) INTO v_p1_correct FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id;
  SELECT count(*) FILTER (WHERE is_correct) INTO v_p2_correct FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id;

  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p1_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND is_correct;
  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p2_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id AND is_correct;

  SELECT rating INTO v_p1_rating FROM profiles WHERE id = v_match.player_1_id;
  SELECT rating INTO v_p2_rating FROM profiles WHERE id = v_match.player_2_id;
  v_p1_expected := 1.0 / (1.0 + power(10.0, (v_p2_rating - v_p1_rating) / 400.0));
  v_p2_expected := 1.0 - v_p1_expected;
  v_p1_actual := CASE WHEN v_winner_id = v_match.player_1_id THEN 1.0 ELSE 0.0 END;
  v_p2_actual := 1.0 - v_p1_actual;
  v_p1_change := round(32 * (v_p1_actual - v_p1_expected));
  v_p2_change := round(32 * (v_p2_actual - v_p2_expected));

  -- الانسحاب بيتحسب خسارة كاملة (نفس معادلة الخسارة العادية) —
  -- عمداً، لأنه لو مفيش عقوبة حقيقية، أي حد بيخسر هيقفل التطبيق
  -- بدل ما يكمل عشان يتفادى نزول تصنيفه، وده بيلغي فايدة الرهان
  -- (stakes) اللي طلبتها أصلاً في أول نسخة من الوضع ده
  UPDATE profiles SET
    rating = rating + v_p1_change,
    total_points = total_points + (v_p1_correct * v_points_per_q) + v_p1_speed_bonus + (CASE WHEN v_winner_id = v_match.player_1_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END)
  WHERE id = v_match.player_1_id;

  UPDATE profiles SET
    rating = rating + v_p2_change,
    total_points = total_points + (v_p2_correct * v_points_per_q) + v_p2_speed_bonus + (CASE WHEN v_winner_id = v_match.player_2_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END)
  WHERE id = v_match.player_2_id;

  UPDATE matches SET
    status = 'finished', winner_id = v_winner_id, end_reason = 'forfeit',
    player_1_rating_change = v_p1_change, player_2_rating_change = v_p2_change,
    finished_at = now()
  WHERE id = p_match_id;

  INSERT INTO notifications (user_id, type, title, body, related_id) VALUES
    (v_winner_id, 'match_result', 'فزت بالتحدي! 🏆', 'الخصم انسحب أو انقطع اتصاله — احتسبنا فوزك بنفس حساب أي مباراة عادية.', p_match_id::text),
    (p_forfeiting_player_id, 'match_result', 'انتهى التحدي', 'خرجت من التحدي أو ما كنتش نشط لفترة طويلة، فاتحسبت خسارة.', p_match_id::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.finalize_match_as_forfeit(uuid, uuid) TO authenticated;

-- ============================================================
-- 4) submit_match_answer — إضافة بسيطة: كل إجابة بتحدّث last_seen
--    بتاع اللي جاوب برضه (دليل نشاط إضافي، مش بديل عن الـ heartbeat)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_match_answer(p_match_id uuid, p_question_index integer, p_selected_index integer)
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

  IF v_user_id = v_match.player_1_id THEN
    UPDATE matches SET player_1_answered_at = now(), player_1_last_seen = now() WHERE id = p_match_id;
  ELSE
    UPDATE matches SET player_2_answered_at = now(), player_2_last_seen = now() WHERE id = p_match_id;
  END IF;

  v_p1_answered := EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND question_index = p_question_index);
  v_p2_answered := EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id AND question_index = p_question_index);
  IF v_p1_answered AND v_p2_answered THEN
    PERFORM advance_match_round(p_match_id, p_question_index);
  END IF;

  RETURN v_is_correct;
END;
$$;

-- ============================================================
-- 5) get_current_match_state — DROP+CREATE (شكل RETURNS TABLE
--    اتغيّر): فحص الانسحاب في الأول + opponent_last_seen للعدّ
--    التنازلي في الواجهة + end_reason للتفرقة في شاشة النتيجة
-- ============================================================
DROP FUNCTION IF EXISTS public.get_current_match_state(uuid);

CREATE FUNCTION public.get_current_match_state(p_match_id uuid)
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
  opponent_correct            boolean,
  my_correct_count            integer,
  opponent_correct_count      integer,
  winner_id                   uuid,
  player_1_id                 uuid,
  player_2_id                 uuid,
  player_1_rating_change      integer,
  player_2_rating_change      integer,
  is_bot_match                boolean,
  bot_difficulty               text,
  opponent_username             text,
  opponent_character            text,
  opponent_rating                integer,
  opponent_last_seen              timestamptz, -- جديد: للعدّ التنازلي قبل الانسحاب في الواجهة
  end_reason                       text         -- جديد: 'completed' | 'forfeit' | null
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
  v_my_correct integer;
  v_opp_correct integer;
  v_opp_correct_now boolean;
  v_opp_username text;
  v_opp_character text;
  v_opp_rating integer;
  v_opp_last_seen timestamptz;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  -- ============================================================
  -- فحص الانسحاب/عدم النشاط — بيشتغل كـ side effect هنا بدل cron
  -- منفصل، لأن أي عميل لسه فاتح شاشة المباراة بينادي الدالة دي
  -- باستمرار أصلاً (Realtime refresh + الـ polling وقت الانتظار)
  -- ============================================================
  IF v_match.status = 'in_progress' AND NOT v_match.is_bot_match THEN
    IF COALESCE(v_match.player_1_last_seen, v_match.started_at) < now() - interval '30 seconds' THEN
      PERFORM finalize_match_as_forfeit(p_match_id, v_match.player_1_id);
    ELSIF COALESCE(v_match.player_2_last_seen, v_match.started_at) < now() - interval '30 seconds' THEN
      PERFORM finalize_match_as_forfeit(p_match_id, v_match.player_2_id);
    END IF;
    SELECT * INTO v_match FROM matches WHERE id = p_match_id; -- إعادة قراءة بعد أي تحديث محتمل
  END IF;

  v_opponent_id := CASE WHEN v_match.player_1_id = v_user_id THEN v_match.player_2_id ELSE v_match.player_1_id END;
  v_ref := v_match.question_ids -> v_match.current_question_index;

  SELECT count(*) FILTER (WHERE is_correct) INTO v_my_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_user_id;
  SELECT count(*) FILTER (WHERE is_correct) INTO v_opp_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_opponent_id;
  SELECT is_correct INTO v_opp_correct_now FROM match_answers
    WHERE match_id = p_match_id AND player_id = v_opponent_id AND question_index = v_match.current_question_index;

  SELECT username, character, rating INTO v_opp_username, v_opp_character, v_opp_rating
    FROM profiles WHERE id = v_opponent_id;

  v_opp_last_seen := CASE WHEN v_match.player_1_id = v_opponent_id THEN v_match.player_1_last_seen ELSE v_match.player_2_last_seen END;

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
    v_opp_correct_now,
    v_my_correct,
    v_opp_correct,
    v_match.winner_id,
    v_match.player_1_id,
    v_match.player_2_id,
    v_match.player_1_rating_change,
    v_match.player_2_rating_change,
    v_match.is_bot_match,
    v_match.bot_difficulty,
    v_opp_username,
    v_opp_character,
    v_opp_rating,
    v_opp_last_seen,
    v_match.end_reason
  FROM questions q
  WHERE v_ref IS NOT NULL
    AND q.level_id = (v_ref->>'level_id')::integer
    AND q.stage_id = (v_ref->>'stage_id')::integer
    AND q.id       = (v_ref->>'id')::integer;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_match.status, v_match.current_question_index, v_match.question_started_at,
      v_match.question_time_limit_seconds, jsonb_array_length(v_match.question_ids),
      NULL::text, NULL::jsonb, false, false, v_opp_correct_now, v_my_correct, v_opp_correct,
      v_match.winner_id, v_match.player_1_id, v_match.player_2_id,
      v_match.player_1_rating_change, v_match.player_2_rating_change,
      v_match.is_bot_match, v_match.bot_difficulty,
      v_opp_username, v_opp_character, v_opp_rating,
      v_opp_last_seen, v_match.end_reason;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_match_state(uuid) TO authenticated;

COMMIT;
