-- ============================================================
-- Mesori — تصحيح 3 أخطاء حقيقية في وضع 1 ضد 1 العشوائي
-- ============================================================
-- يُطبَّق بعد 001-007. اتأكدت من الأخطاء التلاتة دي ببيانات حقيقية
-- من قاعدة بياناتك الحية قبل كتابة أي إصلاح، مش تخمين:
--
-- خطأ 1 (الأخطر): مباريات البوت مالهاش أي حماية من الانسحاب.
-- get_current_match_state كانت بتستثني is_bot_match بالكامل من فحص
-- الانسحاب، لأني افترضت وقتها "مفيش خصم حقيقي يقدر يهرب". اللي
-- فاتني: إجابات البوت نفسها بتتنفّذ من متصفح اللاعب الإنسان (مفيش
-- عميل تاني يمثّل البوت) — فلو الإنسان قفل الشاشة قبل ما يخلّص،
-- البوت بيتوقف عن الإجابة تماماً، وadvance_match_round محتاجة
-- إجابة الاتنين عشان تتقدّم، فالمباراة بتفضل in_progress للأبد.
-- اتأكدت من ده فعلياً: مباراة a1f32e22 واقفة على السؤال التاني من
-- 5 من غير أي تقدّم من 08:04 الصبح.
--
-- خطأ 2: في مباراة إنسان ضد إنسان، لو الاتنين غايبين مع بعض (نادر
-- بس ممكن)، الكود القديم IF/ELSIF كان دايماً يلوم player_1 الأول
-- من غير ما يتأكد إن player_2 مش غايب هو كمان — يعني لو الاتنين
-- سايبين المباراة، player_1 يخسر تصنيف كل مرة بشكل عشوائي غير عادل.
--
-- خطأ 3 (أصغر، لسه يستاهل يتصلّح): لو لاعب دوّر ثم قفل التطبيق قبل
-- ما مؤقّت الـ30 ثانية بتاع البوت يشتغل، صفّه في matchmaking_queue
-- بيفضل موجود، وأي حد تاني بيدوّر ممكن "يتقابل" بيه فعلياً — يعني
-- بيتحط في مباراة ضد حد أصلاً مش موجود. بيتحل تلقائياً بفضل خطأ 2
-- (بعد 30 ثانية هيتحسب انسحاب) لكن أفضل نمنعه من أوله.
-- ============================================================

BEGIN;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_end_reason_check;
ALTER TABLE matches ADD CONSTRAINT matches_end_reason_check
  CHECK (end_reason IN ('completed', 'forfeit', 'void'));

-- ============================================================
-- 1) void_match — إقفال محايد: لا فوز لا خسارة لا تأثير على
--    التصنيف. للحالتين: (أ) الاتنين غايبين مع بعض، (ب) اللاعب
--    سايب مباراة بوت — في الحالتين مفيش "خصم حقيقي" يستاهل يتحسب
--    فايز
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_match(p_match_id uuid)
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

  UPDATE matches SET
    status = 'finished', end_reason = 'void', winner_id = NULL,
    player_1_rating_change = 0, player_2_rating_change = 0,
    finished_at = now()
  WHERE id = p_match_id;

  IF NOT v_match.is_bot_match THEN
    INSERT INTO notifications (user_id, type, title, body, related_id) VALUES
      (v_match.player_1_id, 'match_result', 'اتلغت المباراة', 'الطرفين ما كملوش، فمفيش تأثير على تصنيفك.', p_match_id::text),
      (v_match.player_2_id, 'match_result', 'اتلغت المباراة', 'الطرفين ما كملوش، فمفيش تأثير على تصنيفك.', p_match_id::text);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_match(uuid) TO authenticated;

-- ============================================================
-- 2) get_current_match_state — نفس شكل الإرجاع القديم بالظبط (مفيش
--    عمود جديد، فـ CREATE OR REPLACE عادية كفاية من غير DROP)،
--    التغيير الوحيد في منطق فحص الانسحاب جوّاها:
--    - مباراة بوت: نتابع نشاط اللاعب الإنسان بس، ولو غاب → void
--    - إنسان ضد إنسان: لو الاتنين غايبين مع بعض → void (مش لوم
--      عشوائي)، ولو واحد بس غايب → forfeit عادي زي قبل كده بالظبط
-- ============================================================
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
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  IF v_match.status = 'in_progress' THEN
    IF v_match.is_bot_match THEN
      -- ضد بوت: العنصر الوحيد اللي ممكن "يغيب" هو اللاعب الإنسان —
      -- البوت مالوش نبضة حياة حقيقية أصلاً. لو غاب، مفيش خصم حقيقي
      -- يستاهل يتحسب فايز، فبنقفلها محايدة بدل ما تفضل عالقة للأبد
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

-- ============================================================
-- 3) find_or_create_match — نفس المنطق القديم بالظبط، إضافة واحدة
--    بس: تجاهل أي صف في الطابور أقدم من دقيقتين (أكتر من ضعف
--    الـ30 ثانية زائد هامش أمان) عند البحث عن خصم — يمنع إن حد
--    يتقابل مع صف "شبح" لحد سايب البحث من غير ما يلغيه رسمياً
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

  SELECT id INTO v_match_id FROM matches
    WHERE (player_1_id = v_user_id OR player_2_id = v_user_id)
      AND status = 'in_progress'
    LIMIT 1;
  IF v_match_id IS NOT NULL THEN
    RETURN v_match_id;
  END IF;

  SELECT player_id INTO v_opponent_id FROM matchmaking_queue
    WHERE player_id <> v_user_id
      AND joined_at > now() - interval '2 minutes'
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

COMMIT;
