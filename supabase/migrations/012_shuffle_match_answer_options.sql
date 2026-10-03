-- ============================================================
-- 012_shuffle_match_answer_options.sql
-- ------------------------------------------------------------
-- ملحوظة: طُبّق مباشرة على المشروع الحي (nblmltwjkqlcixguiioq)
-- بتاريخ 2026-08-29. هذا الملف موجود لسجل الـ migrations بالريبو.
--
-- ترتيب الأسئلة في مود 1 ضد 1 (عشوائي/ودّي/بوت) كان بالفعل عشوائياً
-- (pick_random_match_questions تستخدم ORDER BY random() منذ
-- migration 004) — المشكلة الحقيقية كانت ترتيب *اختيارات* كل سؤال:
-- get_current_match_state وget_match_question كانوا بيرجّعوا
-- options زي ما هي مخزّنة بالظبط، بدون أي تبعثر.
--
-- shuffled_indices(seed, count) بتنتج ترتيب ثابت (deterministic)
-- لنفس الـ seed — استخدمنا (match_id + رقم السؤال) كـ seed، فكل
-- من اللاعبين شايف نفس ترتيب الاختيارات بالظبط لنفس السؤال في نفس
-- المباراة (مهم للعدل بينهم)، لكنه يختلف من مباراة لمباراة.
--
-- submit_match_answer اتعدّلت عشان تترجم p_selected_index (اللي
-- جاي من الترتيب المبعثر اللي اللاعب شافه فعلياً) لرقمه الأصلي قبل
-- ما تقارنه بـ correct_index أو تخزّنه — match_answers.selected_index
-- فضل معناه "رقم في الترتيب الأصلي" ثابت، سواء جاي من لاعب حقيقي
-- أو من submit_bot_answer (اللي أصلاً بيشتغل على الترتيب الأصلي
-- من غير ما يتغيّر، فمحتاجش أي تعديل).
-- ============================================================

CREATE OR REPLACE FUNCTION public.shuffled_indices(p_seed text, p_count integer)
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_agg(idx ORDER BY hashtext(p_seed || ':' || idx))
  FROM generate_series(0, p_count - 1) AS idx;
$$;
GRANT EXECUTE ON FUNCTION public.shuffled_indices(text, integer) TO authenticated, anon;


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
  opponent_last_seen              timestamptz,
  end_reason                       text
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
  v_p1_stale boolean;
  v_p2_stale boolean;
  v_question_text text;
  v_options jsonb;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  IF v_match.status = 'in_progress' THEN
    IF v_match.is_bot_match THEN
      IF COALESCE(v_match.player_1_last_seen, v_match.started_at) < now() - interval '30 seconds' THEN
        PERFORM void_match(p_match_id);
      END IF;
    ELSE
      v_p1_stale := COALESCE(v_match.player_1_last_seen, v_match.started_at) < now() - interval '30 seconds';
      v_p2_stale := COALESCE(v_match.player_2_last_seen, v_match.started_at) < now() - interval '30 seconds';
      IF v_p1_stale AND v_p2_stale THEN
        PERFORM void_match(p_match_id);
      ELSIF v_p1_stale THEN
        PERFORM finalize_match_as_forfeit(p_match_id, v_match.player_1_id);
      ELSIF v_p2_stale THEN
        PERFORM finalize_match_as_forfeit(p_match_id, v_match.player_2_id);
      END IF;
    END IF;
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
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

  SELECT q.question, q.options INTO v_question_text, v_options
  FROM questions q
  WHERE v_ref IS NOT NULL
    AND q.level_id = (v_ref->>'level_id')::integer
    AND q.stage_id = (v_ref->>'stage_id')::integer
    AND q.id       = (v_ref->>'id')::integer;

  IF FOUND THEN
    SELECT jsonb_agg(v_options -> perm_idx ORDER BY ord)
      INTO v_options
    FROM unnest(shuffled_indices(p_match_id::text || ':' || v_match.current_question_index::text,
                                  jsonb_array_length(v_options)))
         WITH ORDINALITY AS t(perm_idx, ord);
  ELSE
    v_question_text := NULL;
    v_options := NULL;
  END IF;

  RETURN QUERY
  SELECT
    v_match.status,
    v_match.current_question_index,
    v_match.question_started_at,
    v_match.question_time_limit_seconds,
    jsonb_array_length(v_match.question_ids),
    v_question_text,
    v_options,
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
    v_match.end_reason;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_match_question(p_match_id uuid, p_question_index integer)
RETURNS TABLE (question text, options jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ref jsonb;
  v_question_text text;
  v_options jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id AND (player_1_id = v_user_id OR player_2_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  SELECT question_ids -> p_question_index INTO v_ref FROM matches WHERE id = p_match_id;
  IF v_ref IS NULL THEN
    RAISE EXCEPTION 'رقم سؤال غير صحيح';
  END IF;

  SELECT q.question, q.options INTO v_question_text, v_options
  FROM questions q
  WHERE q.level_id = (v_ref->>'level_id')::integer
    AND q.stage_id = (v_ref->>'stage_id')::integer
    AND q.id       = (v_ref->>'id')::integer;

  SELECT jsonb_agg(v_options -> perm_idx ORDER BY ord)
    INTO v_options
  FROM unnest(shuffled_indices(p_match_id::text || ':' || p_question_index::text,
                                jsonb_array_length(v_options)))
       WITH ORDINALITY AS t(perm_idx, ord);

  RETURN QUERY SELECT v_question_text, v_options;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_match_question(uuid, integer) TO authenticated;


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
  v_option_count integer;
  v_original_selected integer;
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
  SELECT correct_index, jsonb_array_length(options) INTO v_correct_index, v_option_count FROM questions
    WHERE level_id = (v_ref->>'level_id')::integer
      AND stage_id = (v_ref->>'stage_id')::integer
      AND id       = (v_ref->>'id')::integer;

  v_original_selected := (shuffled_indices(p_match_id::text || ':' || p_question_index::text, v_option_count))[p_selected_index + 1];

  v_is_correct := (v_correct_index = v_original_selected);
  v_time_taken_ms := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_match.question_started_at)) * 1000)::integer;

  INSERT INTO match_answers (match_id, player_id, question_index, selected_index, is_correct, time_taken_ms)
  VALUES (p_match_id, v_user_id, p_question_index, v_original_selected, v_is_correct, v_time_taken_ms)
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
