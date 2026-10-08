/*
 * روابط وإصدار الوثائق القانونية (مصدر واحد للإعدادات والموافقة على الشروط).
 * الصفحات منشورة على https://mesori.app (Cloudflare Pages) من public/ — ممكن تتغيّر وقت الـ build:
 *   VITE_PRIVACY_POLICY_URL / VITE_TERMS_URL
 * TERMS_VERSION بيتسجّل مع موافقة المستخدم (profiles.terms_version). لو غيّرت
 * نص الشروط جوهرياً، غيّر التاريخ هنا وفي docs/terms.html.
 */
const PAGES_BASE = 'https://mesori.app';

export const PRIVACY_POLICY_URL = import.meta.env.VITE_PRIVACY_POLICY_URL || `${PAGES_BASE}/privacy-policy.html`;
export const TERMS_URL = import.meta.env.VITE_TERMS_URL || `${PAGES_BASE}/terms.html`;
export const TERMS_VERSION = '2026-10-03';
