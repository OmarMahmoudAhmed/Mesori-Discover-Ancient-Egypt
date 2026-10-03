// scripts/seed-bots.js
//
// بيعمل حسابات البوت اللي وضع "1 ضد 1" بيستخدمها بعد 25-30 ثانية بحث
// من غير خصم حقيقي (شوف migration 006 + request_bot_match()).
//
// ليه سكريبت منفصل ومش INSERT عادي في migration SQL؟ لأن profiles.id
// مربوط بـ FK على auth.users(id) — أي بروفايل لازم يبقى وراه حساب
// auth حقيقي، وإنشاء حساب auth بشكل صحيح (hashed password, aud,
// role...) لازم يعدّي على Admin API (auth.admin.createUser)، مش SQL
// عادي. ده معناه المفتاح السري (SUPABASE_SERVICE_ROLE_KEY) لازم
// يبقى موجود بس محلي عندك — نفس فكرة scripts/seed.js بالظبط.
//
// تشغيل: node scripts/seed-bots.js (مرة واحدة كفاية، السكريبت idempotent
// — تقدر تشغّله تاني براحتك من غير ما يكرر حسابات).

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

console.log('🔑 مفتاح الخدمة السري موجود؟', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'نعم ✅' : 'لا ❌ (تحقق من .env)');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// =============================================
// شخصيات البوت — أسماء وأفاتارات وتصنيفات متنوّعة، عشان نفس اللاعب
// ميقابلش نفس "الخصم" بالظبط كل مرة. مستوى الصعوبة الفعلي (نسبة
// الإجابات الصح) بيتحدد عشوائياً لكل مباراة في request_bot_match()،
// مش هنا — التصنيف هنا بس بيأثر على حساب تغيّر الـELO.
// character لازم يكون من القيم المسموحة في profiles_character_check:
// 'boy' | 'girl' | 'Horus' | 'Isis' | 'Thutmose' | 'Hatshepsut'
// =============================================
const BOT_PERSONAS = [
  { username: 'كريم',   character: 'boy',       rating: 950  },
  { username: 'ياسمين', character: 'girl',      rating: 1050 },
  { username: 'مصطفى',  character: 'Thutmose',  rating: 1120 },
  { username: 'نور',    character: 'Isis',      rating: 890  },
  { username: 'حسن',    character: 'Horus',     rating: 1000 },
  { username: 'سارة',   character: 'Hatshepsut',rating: 1080 },
  { username: 'يوسف',   character: 'boy',       rating: 870  },
  { username: 'مريم',   character: 'girl',      rating: 1150 },
  { username: 'أحمد',   character: 'Horus',     rating: 1010 },
  { username: 'دينا',   character: 'Isis',      rating: 960  },
];

function emailFor(username, index) {
  // نطاق وهمي واضح إنه مش بريد حقيقي — عدّله لو عندك نطاق تفضّله
  return `bot-${index}@mesori.bots.local`;
}

async function findExistingUserIdByEmail(email) {
  // مفيش endpoint مباشر لـ "دوّر بالبريد" في كل نسخ supabase-js، فبنجيب
  // صفحة المستخدمين ونفلتر — عدد المستخدمين هنا صغير فده كفاية ومش
  // هيتكرر غير مرة واحدة عملياً (idempotency)
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) { console.error('❌ فشل جلب قائمة المستخدمين:', error.message); return null; }
  return data.users.find((u) => u.email === email)?.id || null;
}

async function seedBots() {
  console.log('\n🤖 بدء إنشاء حسابات البوت...\n');
  let created = 0, reused = 0, failed = 0;

  for (let i = 0; i < BOT_PERSONAS.length; i++) {
    const persona = BOT_PERSONAS[i];
    const email = emailFor(persona.username, i);

    let userId = await findExistingUserIdByEmail(email);

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: randomUUID(), // البوت ميسجّلش دخول أبداً، القيمة مش مهمة
        email_confirm: true,
      });
      if (error) {
        console.error(`   ❌ فشل إنشاء حساب ${persona.username}:`, error.message);
        failed++;
        continue;
      }
      userId = data.user.id;
      created++;
      console.log(`   ✅ حساب جديد: ${persona.username}`);
    } else {
      reused++;
      console.log(`   ↺ حساب موجود بالفعل: ${persona.username}`);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username: persona.username,
        character: persona.character,
        rating: persona.rating,
        is_bot: true,
        onboarding_completed: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error(`      ❌ فشل حفظ بروفايل ${persona.username}:`, profileError.message);
      failed++;
    }
  }

  console.log(`\n🎉 خلصنا: ${created} حساب جديد، ${reused} موجود بالفعل، ${failed} فشل.`);

  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_bot', true);
  console.log(`   إجمالي حسابات البوت في القاعدة دلوقتي: ${count}`);
  if (!count) {
    console.warn('   ⚠️ لسه محتاج تشغّل supabase/migrations/006_bot_mode_and_realtime_fix.sql الأول (عمود is_bot لسه مش موجود لحد ما تطبّقه).');
  }
}

seedBots();
