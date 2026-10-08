# نشر mesori.app (صفحة الـ Brief) على Cloudflare Pages

الموقع ثابت (static) في فولدر `site/`: الرئيسية = Brief، ومعاها privacy-policy.html وterms.html. اللعبة بتتحمّل من Google Play، فمفيش نسخة ويب.

## النشر
Cloudflare → Workers & Pages → Create → Pages → Connect to Git → الريبو (branch: main)
- Framework preset: None
- Build command: (فاضي)
- Build output directory: `site`
ثم Custom domains → `mesori.app`.

## لو عدّلت الـ classes في index.html
أعد توليد الـ CSS (Tailwind v3) وارفع `site/assets/site.css`، وغيّر `?v=1` في index.html لو عايز تكسر الكاش:
`npx tailwindcss@3.4.17 -c site-src/tailwind.config.js -i site-src/input.css -o site/assets/site.css --minify`

## Google Cloud Console (الهدف الأساسي)
- OAuth consent screen: Home page = `https://mesori.app/` ، Privacy = `https://mesori.app/privacy-policy.html` ، Terms = `https://mesori.app/terms.html`
- Authorized domains: `mesori.app` (وتأكيد الملكية من Search Console بـ TXT record على Cloudflare DNS)
- أرسل `https://mesori.app/sitemap.xml` في Search Console.

## ملاحظات
- ضيف `https://mesori.app/` لـ Supabase Site URL لو هتعتمد عليه.
- روابط التطبيق (src/lib/legal.js) بقت على mesori.app. سيب GitHub Pages القديم شغال لحد ما النسخ القديمة تتحدث.
- امسح الريبو من `.env` من التتبع (اتعمل) وغيّر service_role key.
