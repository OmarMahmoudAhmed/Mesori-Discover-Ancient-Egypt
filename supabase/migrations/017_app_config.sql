-- ============================================================
-- 017_app_config.sql — إعدادات التطبيق عن بُعد (Remote Config) للإعلانات
-- ============================================================
-- جدول Key-Value بسيط يخلّيك تغيّر معرّفات AdMob وتشغّل/توقف الإعلانات
-- وتظبط الفاصل الزمني بدون ما ترفع نسخة جديدة على Google Play.
-- الواجهة بتقرأه من src/lib/adConfig.js (مع cache ساعة + قيم افتراضية آمنة).
--
-- أمان (بنفس أسلوب migration 016):
--   * RLS شغّال، والقراءة لـ authenticated بس (anon مالوش وصول، والإعلانات
--     أصلاً بتظهر بعد تسجيل الدخول).
--   * مفيش أي صلاحية كتابة للعميل: التعديل من Supabase Dashboard ← Table Editor
--     (بحساب الأدمن) أو بـ service_role بس.
--   * is_public: لو ضفت مستقبلاً إعداداً مش للعرض، خلّيه false فما يوصلش للتطبيق.
--
-- القيم الابتدائية = معرّفات الاختبار الرسمية من Google (آمنة) + enable_ads=false.
-- يعني الإعلانات مقفولة لحد ما إنت تفعّلها بنفسك (راجع docs/ADMOB_SETUP.md).
-- ON CONFLICT DO NOTHING: إعادة تشغيل الملف ما بتمسحش قيمك الحقيقية.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  value       text NOT NULL,
  description text,
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT SELECT ON public.app_config TO authenticated;

DROP POLICY IF EXISTS "Authenticated read public app_config" ON public.app_config;
CREATE POLICY "Authenticated read public app_config" ON public.app_config
  FOR SELECT TO authenticated
  USING (is_public);

-- updated_at تلقائي عند أي تعديل
CREATE OR REPLACE FUNCTION public.app_config_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.app_config_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS app_config_touch_updated_at_trigger ON public.app_config;
CREATE TRIGGER app_config_touch_updated_at_trigger
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.app_config_touch_updated_at();

-- ------------------------------------------------------------
-- القيم الابتدائية (لا تعدّل هنا بعد النشر — عدّل من Table Editor)
-- ------------------------------------------------------------
INSERT INTO public.app_config (key, value, description) VALUES
  ('enable_ads',               'false',
   'مفتاح الطوارئ (Kill Switch): true = تشغيل الإعلانات، false = إيقاف الكل فوراً'),
  ('ads_test_mode',            'true',
   'true = إعلانات اختبار Google فقط (آمن للتجربة). خليه false فقط بعد وضع معرّفات AdMob الحقيقية'),
  ('interstitial_ad_id',       'ca-app-pub-3940256099942544/1033173712',
   'معرّف وحدة الإعلان البيني (الافتراضي = معرّف اختبار Google). استبدله بمعرّفك الحقيقي'),
  ('rewarded_ad_id',           'ca-app-pub-3940256099942544/5224354917',
   'معرّف وحدة الإعلان المكافئ (الافتراضي = معرّف اختبار Google). استبدله بمعرّفك الحقيقي'),
  ('interstitial_cooldown_min','3',
   'الحد الأدنى بالدقائق بين إعلانين بينيين (يُحسب كمان من لحظة فتح التطبيق). الموصى به 3 إلى 5')
ON CONFLICT (key) DO NOTHING;
