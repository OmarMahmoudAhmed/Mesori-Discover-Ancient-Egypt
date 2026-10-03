# صفحة Authentication — Mesori

## المحتوى
```
src/
├── pages/LoginPage.jsx
├── components/
│   ├── AuthCard.jsx
│   ├── AuthTabs.jsx
│   ├── InputField.jsx
│   ├── GoldenButton.jsx
│   └── SocialLogin.jsx
└── styles/
    ├── login.css
    ├── animations.css
    └── variables.css

public/assets/
├── logo/logo.png            (مُستخرج من preview.webp الذي أرسلته — بدّله بنسخة عالية الجودة إن توفرت)
└── backgrounds/auth-bg.jpg  (نفس الملاحظة أعلاه)
```

## التثبيت
```bash
npm install framer-motion react-icons
```
(باقي الاعتماديات — React/Vite — موجودة أصلًا في مشروعك)

## طريقة الدمج
1. انسخ مجلد `src/pages`, `src/components`, `src/styles` بالكامل إلى نفس المسارات داخل `src/` في مشروعك (الملفات لا تتعارض مع أي شيء لأن الأسماء خاصة بهذه الصفحة فقط).
2. انسخ `public/assets/logo/logo.png` و `public/assets/backgrounds/auth-bg.jpg` إلى `public/assets/` في مشروعك.
3. استورد الصفحة في الراوتر:
   ```jsx
   import LoginPage from './pages/LoginPage';
   // <Route path="/login" element={<LoginPage />} />
   ```

## ملاحظات مهمة
- **لا يوجد أي اتصال بقاعدة بيانات.** كل دوال الإرسال (`handleLoginSubmit`, `handleSignupSubmit`, وأزرار Google/Facebook/Apple) عبارة عن stubs فارغة معلّقة بتعليق `// TODO`، جاهزة لربطها بـ Supabase لاحقًا.
- تبويب **"إنشاء حساب"** لم يكن مفصّلاً في الصورة المرجعية (كانت تعرض حالة تسجيل الدخول فقط)، فافترضتُ 4 حقول قياسية: الاسم، البريد، كلمة المرور، تأكيد كلمة المرور. عدّلها بسهولة داخل `AuthCard.jsx` إن أردت حقولًا مختلفة.
- الأيقونات (بريد/قفل/عين/جوجل/فيسبوك/آبل) من مكتبة `react-icons` كما طلبت في التعديل الأخير. أيقونات العنخ 🔺 والجناحين ولوتس الفاصل ليست موجودة في أي مكتبة، فتم رسمها يدويًا كـ SVG داخل الأكواد نفسها (لا ملفات خارجية).
- صورتا الشعار والخلفية السفلية في `public/assets` مُستخرجتان مباشرة من الصورة التي أرفقتها (preview.webp) كنقطة بداية عملية. إن كانت لديك نسخ أصلية بجودة أعلى من مصمم/مولّد الصور، استبدلها بنفس الاسم/المسار مباشرة.
- الألوان في `variables.css` مأخوذة بعينات دقيقة (pixel sampling) من الصورة المرفقة، وليست تخمينًا.
