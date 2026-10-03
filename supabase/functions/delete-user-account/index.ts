// supabase/functions/delete-user-account/index.ts
//
// حذف حساب المستخدم الحالي نهائياً (مطلوب من Google Play: مسار حذف داخل التطبيق).
//
// الأمان:
//  - هوية المستخدم تتحدد من الـ JWT فقط (header Authorization). الدالة لا تقرأ
//    أي user id من جسم الطلب، فمستحيل مستخدم يحذف حساب غيره.
//  - مفتاح service_role سرّ بيئة تشغيل Supabase ولا يظهر في كود العميل.
//  - حسابات البوتات (profiles.is_bot) ممنوع حذفها من هنا.
//
// الحذف: (1) prepare_account_deletion(uid) تنهي مبارياته الجارية وتمسح مباريات البوت،
// (2) auth.admin.deleteUser(uid) ← يمسح auth.users ← CASCADE يمسح profiles وكل
// الجداول المرتبطة (user_progress, user_badges, messages, notifications,
// match_answers, matchmaking_queue, leaderboard_stats).
// matches (player_1_id/player_2_id/winner_id) = SET NULL: مباريات الخصم بتفضل
// له (migration 015). user_reports بتفضل بدون ربط (SET NULL) — migration 014.
//
// النشر:
//   supabase functions deploy delete-user-account
// (verify_jwt مفعّل افتراضياً؛ سيبه كده. SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY
//  بيتحقنوا تلقائياً في بيئة Edge Functions.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // نتحقق من الـ JWT عند Supabase Auth ونطلع الـ uid منه
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }
    const uid = userData.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_bot')
      .eq('id', uid)
      .maybeSingle();
    if (profile?.is_bot) {
      return json({ success: false, error: 'forbidden' }, 403);
    }

    // قبل الحذف: ننهي مبارياته الجارية صح (الخصم ياخد الفوز) ونمسح مباريات البوت.
    // مباريات الخصم المنتهية بتفضل له (matches.* = ON DELETE SET NULL، migration 015).
    const { error: prepareError } = await supabaseAdmin.rpc('prepare_account_deletion', { p_user_id: uid });
    if (prepareError) {
      console.error('prepare_account_deletion failed:', prepareError.message);
      return json({ success: false, error: 'prepare_failed' }, 500);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error('deleteUser failed:', deleteError.message);
      return json({ success: false, error: 'delete_failed' }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error('delete-user-account error:', String(err));
    return json({ success: false, error: 'internal_error' }, 500);
  }
});
