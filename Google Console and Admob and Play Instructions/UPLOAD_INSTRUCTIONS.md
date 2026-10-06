# رفع التعديلات على GitHub

الحزمة **تراكمية** مقارنةً بآخر commit على `main` (`a9e91b9`): فيها كل تعديلات الجولة السابقة (الدخول بجوجل والإشعارات والتوقيع) + تجهيز AdMob. لو رفعت الحزمة السابقة قبل كده، ارفع دي فوقها (الملفات المشتركة نسخها الأحدث هنا).

## الخطوات
1. فك `mesori-upload-files.zip` وانسخ **محتويات** مجلد `mesori-upload/` فوق جذر المستودع (اقبل الاستبدال). المسارات داخل المجلد = مسارات المستودع.
2. من جذر المشروع:
   ```bash
   npm install
   npm test            # المتوقع: 130 passed
   npm run build
   npx cap sync android
   ```
3. **لا تلمس `.env`** (الحزمة لا تحتويه).
4. ارفع: `git add -A && git commit -m "feat: google native sign-in, release signing, AdMob groundwork" && git push`
5. Supabase ← SQL Editor: شغّل `supabase/migrations/017_app_config.sql` (الإعلانات تفضل مقفولة بعدها).
6. فعّل GitHub Pages (`main` / `docs`) لتظهر سياسة الخصوصية المحدّثة.

## الملفات (33)
**جديدة (12):** `.env.example` · `android/keystore.properties.example` · `android/app/src/main/res/drawable/ic_stat_mesori.xml` · `docs/ADMOB_SETUP.md` · `docs/GOOGLE_SIGNIN_AND_RELEASE.md` · `src/lib/googleAuth.js` · `src/lib/googleAuth.test.js` · `src/lib/adConfig.js` · `src/lib/adConfig.test.js` · `src/lib/ads.js` · `src/lib/ads.test.js` · `supabase/migrations/017_app_config.sql`

**معدّلة (21):** `.gitignore` · `README.md` · `package.json` · `package-lock.json` · `capacitor.config.json` · `android/app/build.gradle` · `android/app/capacitor.build.gradle` · `android/capacitor.settings.gradle` · `android/app/src/main/AndroidManifest.xml` · `android/app/src/main/res/values/strings.xml` · `data-safety-answers.md` · `privacy-policy.html` · `docs/privacy-policy.html` · `src/App.jsx` · `src/components/auth/SocialLogin.jsx` · `src/components/layout/SettingsDropdown.jsx` · `src/context/AppContext.jsx` · `src/pages/LoginPage.jsx` · `src/pages/QuizPage.jsx` · `src/styles/auth/login.css` · `supabase/README.md`
