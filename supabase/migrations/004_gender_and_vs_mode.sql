-- ============================================================
-- Mesori — تصحيح الأفاتار + الجنس + نظام 1 ضد 1 كامل
-- ============================================================
-- يُطبَّق بعد 001/002/003.
-- ============================================================

BEGIN;

-- ============================================================
-- 0) توسيع أنواع الإشعارات المسموحة (دعوة مباراة + نتيجة مباراة)
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'badge', 'match_invite', 'match_result'));

-- ============================================================
-- 1) تصحيح قيد الأفاتار (كان السبب الحقيقي لعدم حفظ الاختيار)
-- ============================================================
-- الأفاتارات في src/data/avatars.jsx اتغيّرت لـ Horus/Isis/Thutmose/
-- Hatshepsut (بدل pharaoh/anubis/scarab/ankh القديمة)، لكن القيد في
-- القاعدة فضل بالقيم القديمة — أي محاولة حفظ افاتار جديد كانت
-- تترفض بصمت من Postgres (constraint violation)، وده اللي كان بيحس
-- إنه "مفيش حاجة بتتغير" عند الاختيار.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_character_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_character_check
  CHECK (character IN ('boy', 'girl', 'Horus', 'Isis', 'Thutmose', 'Hatshepsut'));

-- ============================================================
-- 2) الجنس (منفصل تماماً عن الأفاتار المُختار)
-- ============================================================
-- عمود اختياري (nullable) — مش كل مستخدم قديم عنده قيمة له، ويُطلب
-- في Onboarding للمستخدمين الجدد. يظهر فقط في نافذة بروفايل اللاعب
-- (عند الضغط عليه من الليدربورد)، مش في صف الليدربورد نفسه ولا في
-- اختيار الأفاتار.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female'));

-- ============================================================
-- 3) نظام 1 ضد 1 — الجداول
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating     integer NOT NULL DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vs_wins    integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vs_losses  integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vs_draws   integer NOT NULL DEFAULT 0;

-- طابور البحث عن خصم عشوائي (صف واحد لكل لاعب بيدور)
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  player_id  uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now()
);

/*
 * المباراة نفسها. question_ids هنا jsonb (مش integer[] زي التصميم
 * الأصلي في VS_MODE_GUIDE.md) — لأن questions مفتاحها مركّب
 * (level_id, stage_id, id) مش id منفردة (id يتكرر 1-10 عبر كل
 * المراحل)، فمحتاجين نخزّن الثلاثة مع بعض لكل سؤال:
 * [{"level_id":1,"stage_id":1,"id":3}, ...]
 *
 * mode يفرّق بين مباراة عشوائية (random) ودعوة صديق (friendly).
 * status تضيف 'pending' (دعوة لسه منتظرة قبول) و'declined' (اتُرفضت)
 * فوق الحالات الأصلية في التصميم القديم.
 */
CREATE TABLE IF NOT EXISTS matches (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                    text NOT NULL CHECK (mode IN ('random', 'friendly')),
  player_1_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_2_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_ids            jsonb NOT NULL,
  status                  text NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('pending','in_progress','finished','abandoned','declined')),
  winner_id               uuid REFERENCES profiles(id),
  player_1_rating_change  integer,
  player_2_rating_change  integer,
  created_at              timestamptz NOT NULL DEFAULT now(),
  started_at              timestamptz,
  finished_at             timestamptz,
  CHECK (player_1_id <> player_2_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player_1_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player_2_id, status);

CREATE TABLE IF NOT EXISTS match_answers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id        uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_index  integer NOT NULL,
  selected_index  integer NOT NULL,
  is_correct      boolean NOT NULL,   -- يُحسب من السيرفر دايماً، مش من العميل
  answered_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id, question_index)
);
CREATE INDEX IF NOT EXISTS idx_match_answers_match ON match_answers(match_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_answers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own queue row" ON matchmaking_queue;
CREATE POLICY "Users manage own queue row" ON matchmaking_queue
  FOR ALL USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);
GRANT SELECT, INSERT, DELETE ON matchmaking_queue TO authenticated;

-- كل لاعب يشوف المباريات اللي هو طرف فيها بس. لا GRANT INSERT/UPDATE
-- مباشر لأي دور — كل تعديل يحصل عبر الدوال (SECURITY DEFINER) تحت،
-- عشان نمنع لاعب من تلفيق نتيجة مباراة أو تسريب إجابات صحيحة.
DROP POLICY IF EXISTS "Players see own matches" ON matches;
CREATE POLICY "Players see own matches" ON matches
  FOR SELECT USING (auth.uid() = player_1_id OR auth.uid() = player_2_id);
GRANT SELECT ON matches TO authenticated;

DROP POLICY IF EXISTS "Players see own match answers" ON match_answers;
CREATE POLICY "Players see own match answers" ON match_answers
  FOR SELECT USING (
    auth.uid() = player_id
    OR auth.uid() IN (SELECT player_1_id FROM matches WHERE id = match_id
                       UNION SELECT player_2_id FROM matches WHERE id = match_id)
  );
GRANT SELECT ON match_answers TO authenticated;

-- ============================================================
-- دالة البحث عن مستخدمين بالاسم (لدعوة صديق لمباراة ودية)
-- ============================================================
/*
 * SECURITY DEFINER عشان تتخطى RLS الصارم على profiles (كل مستخدم
 * يشوف صفّه بس)، لكن بترجّع أعمدة عامة غير حساسة فقط، ومحدودة
 * بـ10 نتائج، ومحتاجة حرفين على الأقل لمنع سحب كل المستخدمين دفعة
 * واحدة.
 */
CREATE OR REPLACE FUNCTION public.search_users_by_username(p_query text)
RETURNS TABLE (id uuid, username text, avatar text)
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
  ORDER BY p.username
  LIMIT 10;
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_users_by_username(text) TO authenticated;

-- ============================================================
-- دالة اختيار 5 أسئلة عشوائية (مشتركة بين العشوائي والودّي)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pick_random_match_questions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(jsonb_build_object('level_id', level_id, 'stage_id', stage_id, 'id', id))
  FROM (
    SELECT level_id, stage_id, id FROM questions ORDER BY random() LIMIT 5
  ) q;
$$;

-- ============================================================
-- المطابقة العشوائية
-- ============================================================
/*
 * SKIP LOCKED مهم جداً هنا: لو لاعبين استدعوا الدالة في نفس اللحظة
 * بالظبط، من غير SKIP LOCKED ممكن الاثنين يحاولوا يمسكوا "نفس"
 * الخصم المنتظر (race condition) ويتسببوا في قفل متبادل (deadlock)
 * أو يتسجّلوا الاثنين في الطابور من غير ما حد ياخد التاني. FOR
 * UPDATE SKIP LOCKED يخلي كل استدعاء "يتخطى" أي صف قافله استدعاء
 * تاني بالفعل، فيلاقي أقرب خصم متاح فعلياً بدل ما يستنى أو يتصادم.
 */
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

  -- عنده مباراة شغالة بالفعل؟ رجّعها بدل ما تعمل واحدة جديدة
  SELECT id INTO v_match_id FROM matches
    WHERE (player_1_id = v_user_id OR player_2_id = v_user_id)
      AND status = 'in_progress'
    LIMIT 1;
  IF v_match_id IS NOT NULL THEN
    RETURN v_match_id;
  END IF;

  -- دوّر على خصم منتظر (غير نفسك)
  SELECT player_id INTO v_opponent_id FROM matchmaking_queue
    WHERE player_id <> v_user_id
    ORDER BY joined_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF v_opponent_id IS NULL THEN
    -- محدش منتظر: سجّل نفسك وارجع NULL (يعني "لسه بتدوّر")
    INSERT INTO matchmaking_queue (player_id) VALUES (v_user_id)
      ON CONFLICT (player_id) DO UPDATE SET joined_at = now();
    RETURN NULL;
  END IF;

  -- لقيت خصم: اعمل المباراة وامسح الاثنين من الطابور
  v_questions := pick_random_match_questions();
  INSERT INTO matches (mode, player_1_id, player_2_id, question_ids, status, started_at)
  VALUES ('random', v_opponent_id, v_user_id, v_questions, 'in_progress', now())
  RETURNING id INTO v_match_id;

  DELETE FROM matchmaking_queue WHERE player_id IN (v_user_id, v_opponent_id);

  RETURN v_match_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_or_create_match() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_matchmaking()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM matchmaking_queue WHERE player_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.cancel_matchmaking() TO authenticated;

-- ============================================================
-- الدعوة الودّية (Friendly Invite)
-- ============================================================
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;
  IF v_user_id = p_opponent_id THEN
    RAISE EXCEPTION 'مينفعش تدعو نفسك';
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
GRANT EXECUTE ON FUNCTION public.invite_friendly_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_friendly_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE matches SET status = 'in_progress', started_at = now()
  WHERE id = p_match_id AND player_2_id = v_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدعوة دي مش موجودة أو مش ليك أو اتقبلت/اتلغت قبل كده';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friendly_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_friendly_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE matches SET status = 'declined', finished_at = now()
  WHERE id = p_match_id AND player_2_id = v_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدعوة دي مش موجودة أو مش ليك أو اتقبلت/اتلغت قبل كده';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decline_friendly_match(uuid) TO authenticated;

-- ============================================================
-- أسئلة المباراة والإجابة عليها
-- ============================================================
/*
 * بتتأكد إن المستدعي طرف في المباراة، وترجّع نص السؤال والاختيارات
 * الأربعة بس — بدون correct_index نهائياً، حتى لا يوصل لأي طرف قبل
 * ما يجاوب (يضر خصمه الحقيقي، مش بس نفسه زي الاختبار الفردي).
 */
CREATE OR REPLACE FUNCTION public.get_match_question(p_match_id uuid, p_question_index integer)
RETURNS TABLE (question text, options jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ref jsonb;
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

  RETURN QUERY
  SELECT q.question, q.options
  FROM questions q
  WHERE q.level_id = (v_ref->>'level_id')::integer
    AND q.stage_id = (v_ref->>'stage_id')::integer
    AND q.id       = (v_ref->>'id')::integer;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_match_question(uuid, integer) TO authenticated;

/*
 * تتحقق من صحة الإجابة هي نفسها (من correct_index في questions)،
 * مش بتصدّق أي is_correct جاي من العميل. لو ده آخر سؤال وكل
 * اللاعبين خلصوا، تستدعي finalize_match تلقائياً.
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
  v_total_questions integer;
  v_p1_answered integer;
  v_p2_answered integer;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL OR (v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id) THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;
  IF v_match.status <> 'in_progress' THEN
    RAISE EXCEPTION 'المباراة دي مش شغالة حالياً';
  END IF;

  v_ref := v_match.question_ids -> p_question_index;
  SELECT correct_index INTO v_correct_index FROM questions
    WHERE level_id = (v_ref->>'level_id')::integer
      AND stage_id = (v_ref->>'stage_id')::integer
      AND id       = (v_ref->>'id')::integer;

  v_is_correct := (v_correct_index = p_selected_index);

  INSERT INTO match_answers (match_id, player_id, question_index, selected_index, is_correct)
  VALUES (p_match_id, v_user_id, p_question_index, p_selected_index, v_is_correct)
  ON CONFLICT (match_id, player_id, question_index) DO NOTHING;

  -- خلّص اللاعبين الاثنين كل الأسئلة؟ لو أيوه، اقفل المباراة
  v_total_questions := jsonb_array_length(v_match.question_ids);
  SELECT count(*) INTO v_p1_answered FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id;
  SELECT count(*) INTO v_p2_answered FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id;

  IF v_p1_answered >= v_total_questions AND v_p2_answered >= v_total_questions THEN
    PERFORM finalize_match(p_match_id);
  END IF;

  RETURN v_is_correct;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_match_answer(uuid, integer, integer) TO authenticated;

/*
 * تحسب الفائز (الأكثر صح، وعند التعادل الأسرع في آخر إجابة)، تطبّق
 * معادلة ELO مبسّطة (K=32)، وتحدّث profiles للاعبين الاثنين +
 * matches.status/winner_id. تُستدعى تلقائياً من submit_match_answer،
 * ومش مكشوفة مباشرة للعميل (بدون GRANT EXECUTE لـ authenticated).
 */
CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_p1_correct integer;
  v_p2_correct integer;
  v_p1_last_answer timestamptz;
  v_p2_last_answer timestamptz;
  v_winner_id uuid;
  v_p1_rating integer; v_p2_rating integer;
  v_p1_expected numeric; v_p2_expected numeric;
  v_p1_actual numeric; v_p2_actual numeric;
  v_p1_change integer; v_p2_change integer;
  v_win_bonus constant integer := 30;
  v_points_per_q constant integer := 4; -- يطابق تقريباً معادلة الاختبار الفردي (100 نقطة / 25 مرحلة / أسئلة أقل هنا)
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL THEN RETURN; END IF; -- مش شغالة أو خلصت بالفعل، تجاهل

  SELECT count(*) FILTER (WHERE is_correct), max(answered_at)
    INTO v_p1_correct, v_p1_last_answer
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_1_id;
  SELECT count(*) FILTER (WHERE is_correct), max(answered_at)
    INTO v_p2_correct, v_p2_last_answer
    FROM match_answers WHERE match_id = p_match_id AND player_id = v_match.player_2_id;

  -- تحديد الفائز: الأكثر صح، وعند التعادل الأسرع في آخر إجابة
  IF v_p1_correct > v_p2_correct THEN v_winner_id := v_match.player_1_id;
  ELSIF v_p2_correct > v_p1_correct THEN v_winner_id := v_match.player_2_id;
  ELSIF v_p1_last_answer < v_p2_last_answer THEN v_winner_id := v_match.player_1_id;
  ELSIF v_p2_last_answer < v_p1_last_answer THEN v_winner_id := v_match.player_2_id;
  ELSE v_winner_id := NULL; -- تعادل تام (نادر جداً)
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
    total_points = total_points + (v_p1_correct * v_points_per_q) + (CASE WHEN v_winner_id = v_match.player_1_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
    vs_draws  = vs_draws  + (CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END)
  WHERE id = v_match.player_1_id;

  UPDATE profiles SET
    rating = rating + v_p2_change,
    total_points = total_points + (v_p2_correct * v_points_per_q) + (CASE WHEN v_winner_id = v_match.player_2_id THEN v_win_bonus ELSE 0 END),
    vs_wins   = vs_wins   + (CASE WHEN v_winner_id = v_match.player_2_id THEN 1 ELSE 0 END),
    vs_losses = vs_losses + (CASE WHEN v_winner_id = v_match.player_1_id THEN 1 ELSE 0 END),
    vs_draws  = vs_draws  + (CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END)
  WHERE id = v_match.player_2_id;

  UPDATE matches SET
    status = 'finished',
    winner_id = v_winner_id,
    player_1_rating_change = v_p1_change,
    player_2_rating_change = v_p2_change,
    finished_at = now()
  WHERE id = p_match_id;

  -- إشعار كل لاعب بالنتيجة
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

-- ============================================================
-- التعامل مع الانقطاع
-- ============================================================
CREATE OR REPLACE FUNCTION public.forfeit_abandoned_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_last_activity timestamptz;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'in_progress';
  IF v_match IS NULL THEN RETURN; END IF;
  IF v_match.player_1_id <> v_user_id AND v_match.player_2_id <> v_user_id THEN
    RAISE EXCEPTION 'مش طرف في المباراة دي';
  END IF;

  SELECT GREATEST(v_match.started_at, COALESCE(max(answered_at), v_match.started_at))
    INTO v_last_activity FROM match_answers WHERE match_id = p_match_id;

  IF v_last_activity > now() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'المباراة لسه نشطة، منقدرش نعلن انسحاب دلوقتي';
  END IF;

  UPDATE matches SET status = 'abandoned', winner_id = v_user_id, finished_at = now()
  WHERE id = p_match_id;

  UPDATE profiles SET vs_wins = vs_wins + 1 WHERE id = v_user_id;
  UPDATE profiles SET vs_losses = vs_losses + 1
    WHERE id = (CASE WHEN v_match.player_1_id = v_user_id THEN v_match.player_2_id ELSE v_match.player_1_id END);
END;
$$;
GRANT EXECUTE ON FUNCTION public.forfeit_abandoned_match(uuid) TO authenticated;

-- ============================================================
-- 4) توسيع leaderboard view بعمود gender (لنافذة بروفايل اللاعب)
-- ============================================================
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.character,
  p.gender,
  p.total_points,
  COALESCE(MAX(up.level_id) FILTER (WHERE up.is_completed), 1) AS level_reached,
  RANK() OVER (ORDER BY p.total_points DESC, p.username ASC) AS rank
FROM public.profiles p
LEFT JOIN public.user_progress up ON up.user_id = p.id
WHERE p.onboarding_completed = true
GROUP BY p.id, p.username, p.character, p.gender, p.total_points
ORDER BY p.total_points DESC, p.username ASC
LIMIT 50;

GRANT SELECT ON public.leaderboard TO anon, authenticated;

COMMIT;
