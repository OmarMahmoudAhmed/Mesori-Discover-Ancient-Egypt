// scripts/import-vs-only-questions.mjs
//
// استيراد دفعة أسئلة جديدة خاصة بوضع 1 ضد 1 / المباراة الودّية فقط.
// نفس شكل JSON بالظبط اللي في Question Template Guide.md (level_id,
// stage_id, question, options, correct_index, explanation) — مفيش
// أي حقل جديد مطلوب من DeepSeek. الفرق الوحيد إن كل صف بيتسجّل بـ
// is_vs_only = true تلقائياً هنا، عشان يتفلتر من وضع المستويات
// (يتطلب تشغيل migration 013_vs_only_questions.sql الأول).
//
// الاستخدام (من جذر المشروع):
//   SUPABASE_SERVICE_ROLE_KEY=<مفتاحك> node scripts/import-vs-only-questions.mjs new-questions-vs-only.json
//
// ملحوظة أمان: شغّله مرة واحدة بس لكل ملف. لو شغّلته مرتين بالغلط
// هيضيف نفس الأسئلة تاني بـ id مختلف (مفيش تصادم PK يمنعك)، يعني
// هتلاقي تكرار فعلي في القاعدة. لو حصل، امسح الصفوف يدوياً من
// Supabase (WHERE is_vs_only = true) وأعد التشغيل.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ استخدام: node scripts/import-vs-only-questions.mjs <path-to-json>');
  process.exit(1);
}

console.log('🔑 مفتاح الخدمة السري موجود؟', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'نعم ✅' : 'لا ❌ (تحقق من .env أو من متغير البيئة)');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

// =============================================
// 1. تحقق من صحة الشكل قبل أي اتصال بالقاعدة
// =============================================
const errors = [];
raw.forEach((q, i) => {
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`[${i}] "${q.question?.slice(0, 30)}..." — لازم بالظبط 4 اختيارات (موجود ${q.options?.length})`);
  }
  if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
    errors.push(`[${i}] correct_index لازم يكون رقم صحيح من 0 لـ 3 (موجود ${q.correct_index})`);
  }
  if (![1, 2, 3, 4, 5].includes(q.level_id)) {
    errors.push(`[${i}] level_id غير صالح: ${q.level_id}`);
  }
  if (![1, 2, 3, 4, 5].includes(q.stage_id)) {
    errors.push(`[${i}] stage_id غير صالح: ${q.stage_id}`);
  }
  if (!q.question || !q.question.trim()) {
    errors.push(`[${i}] نص السؤال فارغ`);
  }
});

if (errors.length) {
  console.error(`\n❌ فيه ${errors.length} خطأ في الملف — اتصلحها الأول ولو محتاجة، ارجع لـ DeepSeek:`);
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}

console.log(`✅ الشكل سليم: ${raw.length} سؤال جاهزين للاستيراد.\n`);

// =============================================
// 2. تجميع حسب (level_id, stage_id) — نقرأ أعلى id
//    مرة واحدة لكل مرحلة بدل مرة لكل سؤال
// =============================================
const byStage = new Map();
for (const q of raw) {
  const key = `${q.level_id}-${q.stage_id}`;
  if (!byStage.has(key)) byStage.set(key, []);
  byStage.get(key).push(q);
}

let totalInserted = 0;

for (const [key, qs] of byStage) {
  const [level_id, stage_id] = key.split('-').map(Number);

  const { data: existing, error: maxErr } = await supabase
    .from('questions')
    .select('id')
    .eq('level_id', level_id)
    .eq('stage_id', stage_id)
    .order('id', { ascending: false })
    .limit(1);

  if (maxErr) {
    console.error(`❌ فشل قراءة أعلى id للمرحلة ${level_id}-${stage_id}:`, maxErr.message);
    continue;
  }

  let nextId = (existing?.[0]?.id || 0) + 1;
  const firstId = nextId;

  const rows = qs.map((q) => ({
    id: nextId++,
    level_id,
    stage_id,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation || null,
    is_vs_only: true, // 🔑 الفرق الوحيد عن scripts/seed.js
  }));

  const { error: insertError } = await supabase.from('questions').insert(rows);

  if (insertError) {
    console.error(`❌ خطأ في إدخال أسئلة المرحلة ${level_id}-${stage_id}:`, insertError.message);
  } else {
    totalInserted += rows.length;
    console.log(`✅ المرحلة ${level_id}-${stage_id}: ${rows.length} سؤال جديد (id ${firstId}→${nextId - 1})، is_vs_only=true`);
  }
}

console.log(`\n🎉 تم إدخال ${totalInserted} سؤال من أصل ${raw.length}.`);

// =============================================
// 3. تحقق نهائي
// =============================================
const { count: vsOnlyCount } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true })
  .eq('is_vs_only', true);

const { count: levelsCount } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true })
  .eq('is_vs_only', false);

console.log(`\n📊 إجمالي أسئلة وضع المستويات (is_vs_only=false): ${levelsCount} (المفروض يفضل 250 زي ما هو)`);
console.log(`📊 إجمالي أسئلة 1v1/الودّي الإضافية (is_vs_only=true): ${vsOnlyCount}`);
