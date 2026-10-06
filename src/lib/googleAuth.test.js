import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  isNative: vi.fn(),
  initialize: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithIdToken: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative } }));
vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: { initialize: mocks.initialize, login: mocks.login, logout: mocks.logout },
}));
vi.mock('./supabaseClient', () => ({
  supabase: { auth: { signInWithOAuth: mocks.signInWithOAuth, signInWithIdToken: mocks.signInWithIdToken } },
}));

async function load() {
  vi.resetModules();
  return import('./googleAuth');
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto); // jsdom لا يوفّر crypto.subtle
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.initialize.mockResolvedValue(undefined);
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.signInWithIdToken.mockResolvedValue({ error: null });
  vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'web-client-id.apps.googleusercontent.com');
});

describe('googleAuth — web', () => {
  it('يستخدم signInWithOAuth ولا يلمس الـ plugin', async () => {
    mocks.isNative.mockReturnValue(false);
    const { signInWithGoogle } = await load();
    await signInWithGoogle();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', options: { redirectTo: window.location.origin + '/' } }),
    );
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.signInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('googleAuth — native', () => {
  beforeEach(() => mocks.isNative.mockReturnValue(true));

  it('يمرّر nonce مُهشَّراً لجوجل و raw لـ Supabase', async () => {
    mocks.login.mockResolvedValue({ result: { idToken: 'ID_TOKEN' } });
    const { signInWithGoogle } = await load();
    await signInWithGoogle();

    expect(mocks.initialize).toHaveBeenCalledWith({ google: { webClientId: 'web-client-id.apps.googleusercontent.com' } });
    const hashed = mocks.login.mock.calls[0][0].options.nonce;
    const { token, nonce: raw, provider } = mocks.signInWithIdToken.mock.calls[0][0];
    expect(provider).toBe('google');
    expect(token).toBe('ID_TOKEN');
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(raw).not.toBe(hashed);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    expect(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')).toBe(hashed);
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('يهيّئ الـ plugin مرة واحدة فقط', async () => {
    mocks.login.mockResolvedValue({ result: { idToken: 'T' } });
    const { signInWithGoogle } = await load();
    await signInWithGoogle();
    await signInWithGoogle();
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it('بدون VITE_GOOGLE_WEB_CLIENT_ID يرمي NOT_CONFIGURED', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', '');
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('إلغاء المستخدم → CANCELLED', async () => {
    mocks.login.mockRejectedValue({ code: '12501', message: 'User cancelled the sign-in' });
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('لا يوجد حساب/خدمات Google Play → NO_ACCOUNT', async () => {
    mocks.login.mockRejectedValue({ message: 'No credentials available' });
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'NO_ACCOUNT' });
  });

  it('انقطاع الشبكة → NETWORK', async () => {
    mocks.login.mockRejectedValue(new Error('Unable to resolve host'));
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('رفض Supabase للتوكن → TOKEN_REJECTED', async () => {
    mocks.login.mockResolvedValue({ result: { idToken: 'T' } });
    mocks.signInWithIdToken.mockResolvedValue({ error: { message: 'Invalid token' } });
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'TOKEN_REJECTED' });
  });

  it('غياب idToken → TOKEN_REJECTED ولا يستدعي Supabase', async () => {
    mocks.login.mockResolvedValue({ result: {} });
    const { signInWithGoogle } = await load();
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'TOKEN_REJECTED' });
    expect(mocks.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('رسالة الخطأ لا تحتوي التوكن', async () => {
    mocks.login.mockResolvedValue({ result: { idToken: 'SECRET_TOKEN_VALUE' } });
    mocks.signInWithIdToken.mockResolvedValue({ error: { message: 'bad SECRET_TOKEN_VALUE' } });
    const { signInWithGoogle } = await load();
    const err = await signInWithGoogle().catch((e) => e);
    expect(err.message).not.toContain('SECRET_TOKEN_VALUE');
  });
});

describe('googleAuth — sign out', () => {
  it('على native يخرج من الـ plugin وعلى الويب لا يفعل شيئاً', async () => {
    const mod = await load();
    mocks.isNative.mockReturnValue(true);
    await mod.signOutGoogleNative();
    expect(mocks.logout).toHaveBeenCalledWith({ provider: 'google' });

    mocks.logout.mockClear();
    mocks.isNative.mockReturnValue(false);
    await mod.signOutGoogleNative();
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it('فشل خروج الـ plugin لا يكسر الخروج', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.logout.mockRejectedValue(new Error('boom'));
    const { signOutGoogleNative } = await load();
    await expect(signOutGoogleNative()).resolves.toBeUndefined();
  });
});
