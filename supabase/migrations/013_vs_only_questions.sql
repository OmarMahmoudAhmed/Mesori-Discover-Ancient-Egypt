-- 013_vs_only_questions.sql
-- =============================================================
-- الهدف: نقدر نضيف أسئلة جديدة لجدول questions تظهر فقط في وضع
-- 1 ضد 1 / المباراة الودّية، وما تظهرش في وضع المستويات الفردي.
--
-- ليه عمود بسيط، مش جدول منفصل؟
-- pick_random_match_questions() (في 004_gender_and_vs_mode.sql)
-- بتسحب من *كل* صفوف questions من غير أي WHERE:
--     SELECT level_id, stage_id, id FROM questions ORDER BY random() LIMIT 5
-- يعني أي سؤال جديد في الجدول هيبقى تلقائياً جزء من مود 1v1
-- من غير أي تعديل على الدالة دي. المشكلة الوحيدة هي وضع
-- المستويات (QuizPage.jsx) اللي بيقرأ:
--     .eq('level_id', levelId).eq('stage_id', stageId).order('id')
-- من غير LIMIT — فأي سؤال زيادة على الـ10 الأساسيين في نفس
-- المرحلة كان هيظهر في اللعب الفردي كمان. العمود ده هو الفلتر
-- اللي بيمنع ده، وهو أبسط بكتير من جدول منفصل أو migration
-- لأي دالة SQL.
--
-- آمن للتشغيل أكتر من مرة بالغلط (IF NOT EXISTS).
-- =============================================================

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS is_vs_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN questions.is_vs_only IS
  'true = سؤال خاص فقط بوضع 1 ضد 1 / المباراة الودّية (لا يظهر في وضع المستويات، شوف QuizPage.jsx). false = من ضمن الـ250 سؤال الأساسية لوضع المستويات (وبرضه متاح لـ1v1 لأن pick_random_match_questions لا تفلتر عليه).';

-- ملحوظة: مفيش أي تعديل مطلوب على pick_random_match_questions() —
-- خليها زي ما هي، وهتشتغل صح تلقائياً بعد الـ migration دي.
