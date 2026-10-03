/*
 * =====================================================
 * sounds.js - نظام تأثيرات صوتية خفيف للتطبيق
 * =====================================================
 * أصوات أساسية بس — بدون أي مكتبة خارجية، Audio API العادية في
 * المتصفح كفاية لتأثيرات بهذا الحجم، وشغالة كمان جوه Capacitor
 * WebView من غير أي plugin إضافي.
 *
 * بيحترم مفتاح الصوت الموجود بالفعل في الإعدادات (isSoundOn من
 * AppContext) — مسجّل عبر setSoundEnabled() من App.jsx.
 *
 * لو ملف صوت لسه مش موجود في public/sounds/، بيتجاهل بهدوء تماماً
 * (من غير أي error يظهر للمستخدم) — ده متعمّد عشان تقدر تضيف
 * الملفات واحد واحد من غير ما حاجة تتكسر لحد ما تخلص كلهم.
 *
 * الدليل الكامل لأسماء الملفات المطلوبة ومواصفاتها: SOUND_GUIDE.md
 * (في جذر المشروع) — ده الملف الوحيد اللي المفروض تحتاج تتعامل معاه.
 * =====================================================
 */

const SOUND_FILES = {
  click:   '/sounds/Click.mp3',
  correct: '/sounds/Correct.mp3',
  wrong:   '/sounds/Wrong.mp3',
  win:     '/sounds/Win.mp3',
  loss:    '/sounds/Loss.mp3',
  draw:    '/sounds/Draw.mp3',
};

// مستويات صوت افتراضية — النقرة أخفت لأنها بتتكرر كتير، لحظات
// النتيجة (فوز/خسارة/تعادل) أعلى شوية لأنها نادرة ومهمة
const VOLUME = {
  click:   0.35,
  correct: 0.5,
  wrong:   0.5,
  win:     0.6,
  loss:    0.55,
  draw:    0.55,
};

let soundEnabled = true;

/* بينادى عليها App.jsx كل ما isSoundOn يتغيّر من الإعدادات */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

// تحميل مسبق (cache) — عنصر Audio واحد لكل صوت، بيتعمله clone عند
// كل تشغيل عشان يسمح بتشغيل متكرر/متداخل (زي نقرات سريعة متتالية)
// من غير ما صوت يقطع اللي قبله
const cache = {};

function getBaseAudio(key) {
  if (!cache[key]) {
    const audio = new Audio(SOUND_FILES[key]);
    audio.preload = 'auto';
    cache[key] = audio;
  }
  return cache[key];
}

export function playSound(key) {
  if (!soundEnabled) return;
  if (!SOUND_FILES[key]) return;

  try {
    const node = getBaseAudio(key).cloneNode();
    node.volume = VOLUME[key] ?? 0.5;
    node.play().catch(() => {
      /* تجاهل بهدوء: الملف لسه مش مضاف، أو المتصفح رفض التشغيل
         التلقائي قبل أول تفاعل حقيقي من المستخدم — الحالتين طبيعيتين */
    });
  } catch {
    /* تجاهل بهدوء لأي سبب تاني غير متوقع */
  }
}
