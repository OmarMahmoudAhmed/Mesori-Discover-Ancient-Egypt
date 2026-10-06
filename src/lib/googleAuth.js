/**
 * googleAuth — تسجيل الدخول بجوجل
 *
 *  - على Android (Capacitor): تسجيل دخول أصلي عبر Credential Manager (plugin: @capgo/capacitor-social-login)
 *    ثم تمرير الـ ID token إلى Supabase عبر signInWithIdToken.
 *    السبب: جوجل تمنع OAuth داخل الـ WebView (disallowed_useragent).
 *  - على الويب: يبقى signInWithOAuth بالـ redirect كما هو.
 *
 * ملاحظة أمنية: لا يُسجَّل الـ ID token ولا الـ nonce في أي مكان.
 */
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from './supabaseClient';

/** رموز أخطاء داخلية → رسائل عربية ودّية */
export const GOOGLE_AUTH_ERRORS = {
  CANCELLED: 'تم إلغاء تسجيل الدخول.',
  NO_ACCOUNT: 'مفيش حساب جوجل على الجهاز، أو خدمات Google Play غير متاحة. أضف حساب جوجل وجرّب تاني.',
  NETWORK: 'مشكلة في الاتصال بالإنترنت. تأكد من الشبكة وجرّب تاني.',
  TOKEN_REJECTED: 'تعذّر التحقق من حساب جوجل. جرّب تاني أو استخدم البريد وكلمة المرور.',
  NOT_CONFIGURED: 'تسجيل الدخول بجوجل غير مُهيّأ في هذه النسخة. استخدم البريد وكلمة المرور.',
  UNKNOWN: 'فشل تسجيل الدخول بجوجل. جرّب تاني أو استخدم البريد وكلمة المرور.',
};

export class GoogleAuthError extends Error {
  constructor(code) {
    super(GOOGLE_AUTH_ERRORS[code] || GOOGLE_AUTH_ERRORS.UNKNOWN);
    this.name = 'GoogleAuthError';
    this.code = code in GOOGLE_AUTH_ERRORS ? code : 'UNKNOWN';
  }
}

/** تحويل أي خطأ من الـ plugin أو Supabase إلى رمز داخلي (بدون تسريب بيانات حساسة) */
export function classifyGoogleError(err) {
  const raw = `${err?.code ?? ''} ${err?.message ?? ''}`.toLowerCase();
  if (/cancel|dismiss|user_cancel|\[?12501\]?|\b16\b.*cancel/.test(raw)) return 'CANCELLED';
  if (/no credential|no_credential|no account|nocredential|play services|play_services|unavailable|\b10\b/.test(raw)) {
    return raw.includes('network') ? 'NETWORK' : 'NO_ACCOUNT';
  }
  if (/network|offline|timeout|failed to fetch|unable to resolve/.test(raw)) return 'NETWORK';
  return 'UNKNOWN';
}

/** nonce عشوائي (raw) + نسخة SHA-256 hex منه (تذهب لجوجل) */
export async function generateNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

let initPromise = null;

/** تهيئة الـ plugin مرة واحدة (Web Client ID من VITE_GOOGLE_WEB_CLIENT_ID — معرّف عام وليس سراً) */
async function ensureInitialized() {
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new GoogleAuthError('NOT_CONFIGURED');
  if (!initPromise) {
    initPromise = SocialLogin.initialize({ google: { webClientId } }).catch((e) => {
      initPromise = null; // اسمح بإعادة المحاولة
      throw e;
    });
  }
  return initPromise;
}

/** هل نحن داخل تطبيق Android/iOS الأصلي؟ */
export const isNativeApp = () => Capacitor.isNativePlatform();

/** دخول بجوجل — يختار المسار حسب المنصة */
export async function signInWithGoogle() {
  if (!isNativeApp()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    });
    if (error) throw new GoogleAuthError('UNKNOWN');
    return;
  }

  let idToken;
  const { raw, hashed } = await generateNonce();
  try {
    await ensureInitialized();
    const res = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'], nonce: hashed },
    });
    idToken = res?.result?.idToken;
  } catch (e) {
    if (e instanceof GoogleAuthError) throw e;
    throw new GoogleAuthError(classifyGoogleError(e));
  }
  if (!idToken) throw new GoogleAuthError('TOKEN_REJECTED');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce: raw,
  });
  if (error) {
    throw new GoogleAuthError(classifyGoogleError(error) === 'NETWORK' ? 'NETWORK' : 'TOKEN_REJECTED');
  }
}

/** تسجيل الخروج من الـ plugin (بدون أن يفشل الخروج الأساسي لو حصل خطأ) */
export async function signOutGoogleNative() {
  if (!isNativeApp()) return;
  try {
    await SocialLogin.logout({ provider: 'google' });
  } catch {
    /* لا مشكلة: الجلسة الأساسية في Supabase تُنهى على أي حال */
  }
}
