-- ============================================================
-- Mesori — تصحيح شامل للـ Schema
-- ============================================================
-- هذا الملف يستبدل محتوى "Supabase SQL editor (Copy)/SQL1"
-- بنسخة مُصححة. المشاكل التي يحلّها بالتحديد:
--
-- 1) أعمدة ناقصة كانت تسبب خطأ 400 عند القراءة:
--    levels.name_en و stages.description و stages.emoji
--    و questions.explanation — كل هذه القيم موجودة فعلاً في
--    src/data/levels.js و src/data/quizzes.js، وكانت الواجهة
--    (AppContext.jsx) تطلبها من قاعدة البيانات، لكن الجدول
--    الأصلي لم يكن يحتوي عليها كأعمدة.
--
-- 2) مشكلة أخطر لم تظهر كخطأ ظاهر: كان id الخاص بـ stages
--    يتكرر (1-5) داخل كل مستوى، و id الخاص بـ questions يتكرر
--    (1-10) داخل كل مرحلة — وهذا التصميم مقصود في بيانات
--    الواجهة نفسها (id محلي وليس عام). لكن بما أن id كان هو
--    المفتاح الأساسي الوحيد في الجدولين، فإن seed.js كان
--    يستبدل (upsert) بيانات كل مستوى/مرحلة فوق سابقتها بصمت:
--    نتيجة ذلك أن جدول stages ينتهي بـ 5 صفوف فقط (مستوى 5 فقط)
--    بدل 25، وجدول questions ينتهي بـ 10 صفوف فقط (آخر مرحلة)
--    بدل 250 — فقدان بيانات صامت خطير رغم عدم وجود أي رسالة
--    خطأ. الحل: مفتاح أساسي مركّب (level_id, id) للمراحل،
--    و(level_id, stage_id, id) للأسئلة.
--
-- 3) خطأ 401 على questions رغم وجود RLS policy صحيحة: السبب أن
--    RLS تتحكم في مستوى "الصف" فقط، لكن PostgREST يحتاج أولاً
--    GRANT فعلي على مستوى "الجدول" للدور anon — وكان GRANT
--    ممنوحاً فقط لـ service_role.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS questions      CASCADE;
DROP TABLE IF EXISTS stages         CASCADE;
DROP TABLE IF EXISTS levels         CASCADE;
DROP TABLE IF EXISTS profiles       CASCADE;

-- ---------- profiles ----------
-- id مرتبط بـ auth.users — الجدول جاهز الآن لكن لن يُستخدم
-- فعلياً من الواجهة إلا بعد إضافة تسجيل الدخول (مرحلة قادمة).
-- أضفنا age / country / country_flag لأنها حقول بسيطة لا تعتمد
-- على نظام الدخول، فلا داعي لهجرة أخرى وقت بناء صفحة الحساب.
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     text NOT NULL,
  character    text NOT NULL DEFAULT 'boy' CHECK (character IN ('boy', 'girl')),
  age          integer,
  country      text,
  country_flag text,
  total_points integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- levels ----------
CREATE TABLE levels (
  id         integer PRIMARY KEY,
  name_ar    text NOT NULL,
  name_en    text NOT NULL,
  difficulty text NOT NULL,
  max_points integer NOT NULL DEFAULT 100
);

-- ---------- stages ----------
-- مفتاح مركّب (level_id, id): id يتكرر 1-5 عبر المستويات المختلفة
-- بتصميم متعمّد يطابق شكل بيانات الواجهة، فلا يصلح كمفتاح منفرد.
CREATE TABLE stages (
  id          integer NOT NULL,
  level_id    integer NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  emoji       text,
  order_index integer NOT NULL DEFAULT 1,
  PRIMARY KEY (level_id, id)
);

-- ---------- questions ----------
-- نفس المبدأ: id يتكرر 1-10 داخل كل مرحلة، فأضفنا level_id
-- والمفتاح الأساسي مركّب (level_id, stage_id, id)، والـ FK
-- يشير لنفس المفتاح المركّب في stages لضمان تطابق level_id.
CREATE TABLE questions (
  id            integer NOT NULL,
  level_id      integer NOT NULL,
  stage_id      integer NOT NULL,
  question      text NOT NULL,
  options       jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation   text,
  PRIMARY KEY (level_id, stage_id, id),
  FOREIGN KEY (level_id, stage_id) REFERENCES stages (level_id, id) ON DELETE CASCADE
);

-- ---------- user_progress ----------
-- غير مُستخدَم فعلياً بعد (لا يوجد auth.uid() حقيقي حتى الآن)،
-- لكن الجدول والـ RLS جاهزان لمرحلة تسجيل الدخول القادمة مباشرة
-- بدون أي هجرة إضافية.
CREATE TABLE user_progress (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level_id     integer NOT NULL,
  stage_id     integer NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  best_score   integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level_id, stage_id),
  FOREIGN KEY (level_id, stage_id) REFERENCES stages (level_id, id) ON DELETE CASCADE
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- محتوى تعليمي عام، يُقرأ بلا تسجيل دخول
CREATE POLICY "Public levels read"    ON levels    FOR SELECT USING (true);
CREATE POLICY "Public stages read"    ON stages    FOR SELECT USING (true);
CREATE POLICY "Public questions read" ON questions FOR SELECT USING (true);

-- بيانات شخصية: كل مستخدم يرى/يعدّل صفّه فقط (تُفعَّل عملياً
-- بعد إضافة تسجيل الدخول؛ حالياً auth.uid() = NULL دائماً فلا
-- تُرجع أي صفوف لأي طلب مجهول، وهذا سلوك آمن ومقصود)
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own progress" ON user_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 🔑 GRANT على مستوى الجدول — هذا بالتحديد كان ناقصاً وسبب 401
-- (RLS تتحكم في "أي صفوف"، لكن الدور يحتاج إذن الوصول للجدول
-- نفسه أولاً؛ SQL3 القديم كان يمنحه لـ service_role فقط)
-- ============================================================
GRANT SELECT ON levels, stages, questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles, user_progress TO authenticated;
GRANT ALL PRIVILEGES ON levels, stages, questions, profiles, user_progress TO service_role;

COMMIT;
