-- ============================================================
-- Mesori — تفعيل Realtime الفعلي + وضع البوت (Stealth Fallback)
-- ============================================================
-- يُطبَّق بعد 001-005.
--
-- ## اكتشاف مهم قبل أي حاجة تانية في الملف ده ##
-- publication الاسمها supabase_realtime (اللي بيعتمد عليها كل
-- .channel().on('postgres_changes', ...) في VsLobbyPage.jsx و
-- VsMatchPage.jsx) مفيهاش ولا جدول واحد حالياً على مشروعك الحي.
-- ده معناه إن أحداث الـ Realtime مش بتوصل خالص لأي حد — كل عميل
-- بيعمل fetch أول مرة بس وبعدين يفضل مستني أحداث مش هتيجي أبداً،
-- لحد ما الـ timer المحلي (15 ثانية) يجبره يبعت إجابة. ده غالباً
-- السبب الحقيقي وراء إحساسك إن الوضع "مش حقيقي" — مش لأن منطق
-- المطابقة أو التزامن غلط (هو صح فعلاً وموجود بالكامل من migration
-- 005)، لكن لأن القناة اللي المفروض توصّل التحديثات كانت مقفولة.
--
-- التغييرات في الملف ده:
-- 1) تفعيل Realtime فعلياً على matches (القسم 1)
-- 2) أعمدة جديدة: is_bot_match, bot_difficulty على matches،
--    و is_bot على profiles
-- 3) player_1_answered_at / player_2_answered_at: عشان submit_match_answer
--    يعمل UPDATE على matches مع كل إجابة (مش بس لما الاتنين يخلصوا)،
--    فيوصل حدث Realtime فوري للطرف التاني بمجرد ما حد يجاوب
-- 4) get_current_match_state: بترجع دلوقتي هوية الخصم (اسم/أفاتار/
--    تصنيف) + نتيجة حية لحظية للاتنين + هل إجابة الخصم في السؤال
--    الحالي صح ولا غلط (من غير ما تكشف نص الإجابة الصح)
-- 5) request_bot_match(): تستبدل خصم حقيقي ببوت بعد ما اللاعب
--    يستنى 25-30 ثانية من غير مطابقة
-- 6) submit_bot_answer(): بيتقال من عميل اللاعب نفسه (مفيش عميل
--    تاني للبوت أصلاً)، لكن الصح/الغلط بيتحسب من السيرفر برضه
--    مش من الكلاينت، عشان أي تحسين مستقبلي لمنع التلاعب يبقى سهل
-- 7) finalize_match: بتتخطى تحديث بروفايل البوت (مفيش تصنيف/فوز/
--    خسارة حقيقية لحساب وهمي)
-- ============================================================

BEGIN;

-- ============================================================
-- 1) تفعيل Realtime — ده الإصلاح الأهم في الملف كله
-- ============================================================
ALTER TABLE matches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- ============================================================
-- 2) أعمدة وضع البوت
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_bot_match   boolean NOT NULL DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bot_difficulty text CHECK (bot_difficulty IN ('easy','medium','hard'));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_1_answered_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_2_answered_at timestamptz;

-- علم على بروفايلات البوت (حسابات auth.users حقيقية، لازم تتعمل عبر
-- scripts/seed-bots.js — راجع الملف المرفق، مينفعش تتعمل بـ INSERT
-- عادي هنا لأن profiles.id مربوط بـ FK على auth.users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3) get_current_match_state — لازم DROP الأول لأن شكل الأعمدة
--    الراجعة اتغيّر (Postgres مش بيسمح بتغيير RETURNS TABLE بـ
--    CREATE OR REPLACE لوحدها)
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
  opponent_correct            boolean,   -- جديد: صح/غلط بس، مش الاختيار نفسه
  my_correct_count            integer,   -- جديد: نتيجتي الحية
  opponent_correct_count      integer,   -- جديد: نتيجة الخصم الحية
  winner_id                   uuid,
  player_1_id                 uuid,
  player_2_id                 uuid,
  player_1_rating_change      integer,
  player_2_rating_change      integer,
  is_bot_match                boolean,   -- جديد: يُستخدم داخلياً بس لتشغيل
                                          -- محاكاة البوت — ما تعرضوش في أي UI نص
  bot_difficulty               text,
  opponent_username            text,     -- جديد
  opponent_character           text,     -- جديد: مفتاح الأفاتار (AvatarDisplay)
  opponent_rating               integer  -- جديد
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
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
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
    v_opp_rating
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
      v_opp_username, v_opp_character, v_opp_rating;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_match_state(uuid) TO authenticated;

-- ============================================================
-- 4) submit_match_answer — نفس المنطق القديم + بيسجّل وقت إجابة كل
--    لاعب على matches نفسها (مش بس match_answers)، عشان يعمل UPDATE
--    يوصل Realtime فوراً حتى لو الطرف التاني لسه ما جاوبش
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
    UPDATE matches SET player_1_answered_at = now() WHERE id = p_match_id;
  ELSE
    UPDATE matches SET player_2_answered_at = now() WHERE id = p_match_id;
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
-- 5) advance_match_round — زودنا تصفير عمودي answered_at الجديدين
--    مع كل سؤال جديد
-- ============================================================
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
    PERFORM finalize_match(p_match_id);
  ELSE
    UPDATE matches
      SET current_question_index = p_expected_index + 1,
          question_started_at = now(),
          player_1_answered_at = NULL,
          player_2_answered_at = NULL
      WHERE id = p_match_id AND current_question_index = p_expected_index AND status = 'in_progress';
  END IF;
END;
$$;

-- ============================================================
-- 6) finalize_match — نفس حساب النتيجة/السرعة/الـELO القديم +
--    تخطي تحديث بروفايل البوت والإشعار له
-- ============================================================
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
  v_max_speed_bonus constant integer := 3;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE is_correct) INTO v_p1_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id;
  SELECT count(*) FILTER (WHERE is_correct) INTO v_p2_correct
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id;

  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p1_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND is_correct;
  SELECT COALESCE(round(sum(GREATEST(0, (v_match.question_time_limit_seconds * 1000 - time_taken_ms))::numeric
           / (v_match.question_time_limit_seconds * 1000) * v_max_speed_bonus)), 0)
    INTO v_p2_speed_bonus
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id AND is_correct;

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

  -- جديد: البوت مفيش له بروفايل حقيقي يستاهل تحديث تصنيف/فوز/خسارة
  IF NOT v_match.is_bot_match THEN
    UPDATE profiles SET
      rating = rating + v_p2_change,
      total_points = total_points + (v_p2_correct * v_points_per_q) + v_p2_speed_bonus + (CASE WHEN v_winner_id = v_match.player_2_id THEN v_win_bonus ELSE 0 END),
      vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
      vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
      vs_draws  = vs_draws  + (CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END)
    WHERE id = v_match.player_2_id;
  END IF;

  UPDATE matches SET
    status = 'finished', winner_id = v_winner_id,
    player_1_rating_change = v_p1_change, player_2_rating_change = v_p2_change,
    finished_at = now()
  WHERE id = p_match_id;

  INSERT INTO notifications (user_id, type, title, body, related_id) VALUES
    (v_match.player_1_id, 'match_result',
     CASE WHEN v_winner_id = v_match.player_1_id THEN 'فزت في المباراة! 🏆' WHEN v_winner_id IS NULL THEN 'تعادلت في المباراة' ELSE 'خسرت المباراة' END,
     format('%s صح من %s، تغيّر التصنيف: %s%s', v_p1_correct, jsonb_array_length(v_match.question_ids), CASE WHEN v_p1_change >= 0 THEN '+' ELSE '' END, v_p1_change),
     p_match_id::text);

  IF NOT v_match.is_bot_match THEN
    INSERT INTO notifications (user_id, type, title, body, related_id) VALUES
      (v_match.player_2_id, 'match_result',
       CASE WHEN v_winner_id = v_match.player_2_id THEN 'فزت في المباراة! 🏆' WHEN v_winner_id IS NULL THEN 'تعادلت في المباراة' ELSE 'خسرت المباراة' END,
       format('%s صح من %s، تغيّر التصنيف: %s%s', v_p2_correct, jsonb_array_length(v_match.question_ids), CASE WHEN v_p2_change >= 0 THEN '+' ELSE '' END, v_p2_change),
       p_match_id::text);
  END IF;
END;
$$;

-- ============================================================
-- 7) request_bot_match — يتصل من الكلاينت بعد 25-30 ثانية بحث
--    من غير خصم حقيقي. الفرق عن find_or_create_match: هنا مبني
--    على إن اللاعب أصلاً واقف في matchmaking_queue من قبل.
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_bot_match()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_queue_row matchmaking_queue%ROWTYPE;
  v_bot_id uuid;
  v_match_id uuid;
  v_questions jsonb;
  v_difficulty text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;

  -- لو فعلاً اتقابل بخصم حقيقي في نفس اللحظة تقريباً، رجّع مباراته
  -- بدل ما تلفّق بوت فوقها
  SELECT id INTO v_match_id FROM matches
    WHERE (player_1_id = v_user_id OR player_2_id = v_user_id) AND status = 'in_progress'
    LIMIT 1;
  IF v_match_id IS NOT NULL THEN
    RETURN v_match_id;
  END IF;

  SELECT * INTO v_queue_row FROM matchmaking_queue WHERE player_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    -- مش واقف في الطابور أصلاً (يمكن اتقابل ولسه الـ Realtime في
    -- طريقه، أو ألغى البحث) — سيب الكلاينت يستنى قناته
    RETURN NULL;
  END IF;

  -- هامش أمان 5 ثواني تحت الـ30 بتاعة الكلاينت (اختلاف ساعة المتصفح
  -- عن السيرفر ميرفضش طلب شرعي بالغلط)
  IF v_queue_row.joined_at > now() - interval '25 seconds' THEN
    RAISE EXCEPTION 'لسه بدري على تفعيل البوت';
  END IF;

  SELECT id INTO v_bot_id FROM profiles WHERE is_bot = true ORDER BY random() LIMIT 1;
  IF v_bot_id IS NULL THEN
    RAISE EXCEPTION 'مفيش حسابات بوت متاحة — شغّل scripts/seed-bots.js الأول';
  END IF;

  v_difficulty := (ARRAY['easy','medium','hard'])[floor(random() * 3 + 1)];
  v_questions := pick_random_match_questions();

  INSERT INTO matches (
    mode, player_1_id, player_2_id, question_ids, status, started_at,
    current_question_index, question_started_at, is_bot_match, bot_difficulty
  )
  VALUES (
    'random', v_user_id, v_bot_id, v_questions, 'in_progress', now(),
    0, now(), true, v_difficulty
  )
  RETURNING id INTO v_match_id;

  DELETE FROM matchmaking_queue WHERE player_id = v_user_id;

  RETURN v_match_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_bot_match() TO authenticated;

-- ============================================================
-- 8) submit_bot_answer — بيتقال من متصفح اللاعب الإنسان نفسه (مفيش
--    عميل تاني يمثّل البوت)، لكن الصح/الغلط بيتحسم من السيرفر زي
--    أي إجابة حقيقية بالظبط — الكلاينت بيحدد التوقيت بس، مش النتيجة
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_bot_answer(p_match_id uuid, p_question_index integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_chance numeric;
  v_is_correct boolean;
  v_wrong_index integer;
  v_ref jsonb;
  v_correct_index integer;
  v_option_count integer;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR v_match.player_1_id <> v_user_id OR NOT v_match.is_bot_match THEN
    RAISE EXCEPTION 'مش مباراة بوت بتخصّك';
  END IF;
  IF v_match.status <> 'in_progress' OR p_question_index <> v_match.current_question_index THEN
    RETURN NULL; -- الجولة اتقدّمت بالفعل قبل ما الـ timer المحلي يوصل — تجاهل بهدوء
  END IF;

  v_chance := CASE v_match.bot_difficulty
    WHEN 'easy' THEN 0.45
    WHEN 'hard' THEN 0.85
    ELSE 0.65
  END;
  v_is_correct := random() < v_chance;

  v_ref := v_match.question_ids -> p_question_index;
  SELECT correct_index, jsonb_array_length(options) INTO v_correct_index, v_option_count
    FROM questions
    WHERE level_id = (v_ref->>'level_id')::integer
      AND stage_id = (v_ref->>'stage_id')::integer
      AND id       = (v_ref->>'id')::integer;

  IF v_is_correct THEN
    v_wrong_index := v_correct_index;
  ELSE
    -- إزاحة عشوائية من 1 لحد (عدد الاختيارات - 1) فوق الإجابة الصح،
    -- بالـ modulo — يضمن نتيجة مختلفة عن الصح من غير أي loop
    v_wrong_index := (v_correct_index + 1 + floor(random() * GREATEST(v_option_count - 1, 1)))::integer % v_option_count;
  END IF;

  INSERT INTO match_answers (match_id, player_id, question_index, selected_index, is_correct, time_taken_ms)
  VALUES (p_match_id, v_match.player_2_id, p_question_index, v_wrong_index, v_is_correct,
          GREATEST(0, EXTRACT(EPOCH FROM (now() - v_match.question_started_at)) * 1000)::integer)
  ON CONFLICT (match_id, player_id, question_index) DO NOTHING;

  UPDATE matches SET player_2_answered_at = now() WHERE id = p_match_id;

  IF EXISTS (SELECT 1 FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id AND question_index = p_question_index) THEN
    PERFORM advance_match_round(p_match_id, p_question_index);
  END IF;

  RETURN v_is_correct;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_bot_answer(uuid, integer) TO authenticated;

COMMIT;
