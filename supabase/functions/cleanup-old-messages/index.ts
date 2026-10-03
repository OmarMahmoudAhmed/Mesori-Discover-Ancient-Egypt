// supabase/functions/cleanup-old-messages/index.ts
//
// بديل لـ pg_cron لو مش متاح في خطة مشروعك على Supabase. تستدعي
// هذه الدالة (Edge Function) دالة قاعدة البيانات
// delete_old_messages_and_notifications() باستخدام مفتاح
// service_role (صلاحية كاملة، آمن هنا لأنه سرّ بيئة تشغيل وليس
// كوداً في المتصفح).
//
// كيف تنشرها:
//   supabase functions deploy cleanup-old-messages
//
// كيف تجدولها (اختر واحدة):
// 1) Supabase Dashboard → Database → Cron Jobs → أنشئ وظيفة جديدة
//    تستدعي رابط هذه الدالة يومياً.
// 2) أي خدمة جدولة خارجية (cron-job.org، GitHub Actions
//    scheduled workflow...) تعمل طلب POST يومي لرابط الدالة بعد نشرها،
//    مع هيدر Authorization: Bearer <ANON_KEY_أو_SERVICE_ROLE_KEY>.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabaseAdmin.rpc('delete_old_messages_and_notifications');

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, ranAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
