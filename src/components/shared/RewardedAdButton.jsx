// معلّق مؤقتاً: الإعلان المكافئ غير مستخدم حالياً. الكود محفوظ هنا للرجوع إليه.
// /*
//  * =====================================================
//  * RewardedAdButton.jsx - إعلان مكافئ اختياري
//  * =====================================================
//  * يظهر فقط على Android/iOS الأصلي، ولو الإعلانات مفعّلة من Supabase،
//  * ولم يتجاوز المستخدم الحد اليومي. المكافأة: ساعة بدون إعلانات بينية.
//  * =====================================================
//  */
// import React, { useEffect, useState } from 'react';
// import { canShowRewardedAd, showRewardedAd, grantAdFreeHour } from '../../lib/ads';
//
// function RewardedAdButton() {
//   const [available, setAvailable] = useState(false);
//   const [busy, setBusy] = useState(false);
//   const [done, setDone] = useState(false);
//   const [message, setMessage] = useState('');
//
//   useEffect(() => {
//     let alive = true;
//     canShowRewardedAd().then((ok) => {
//       if (alive) setAvailable(ok);
//     });
//     return () => {
//       alive = false;
//     };
//   }, []);
//
//   const handleClick = async () => {
//     if (busy) return;
//     setBusy(true);
//     setMessage('');
//     const result = await showRewardedAd();
//     setBusy(false);
//     if (result?.rewarded) {
//       grantAdFreeHour();
//       setDone(true);
//     } else {
//       setMessage('لم تكتمل مشاهدة الإعلان، ولم تُضَف أي مكافأة. يمكنك المحاولة مرة أخرى.');
//     }
//   };
//
//   if (done) {
//     return (
//       <p
//         className="text-xs text-center mb-3 px-4"
//         style={{ fontFamily: "'Cairo', sans-serif", color: '#2D6A3F' }}
//       >
//         شكراً! لن تظهر إعلانات بينية لمدة ساعة.
//       </p>
//     );
//   }
//
//   if (!available) return null;
//
//   return (
//     <div className="w-full mb-3">
//       <button
//         onClick={handleClick}
//         disabled={busy}
//         className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold press-effect no-tap-highlight"
//         style={{
//           backgroundColor: 'white',
//           border: '1px solid rgba(200,146,42,0.4)',
//           color: '#805D1B',
//           fontFamily: "'Cairo', sans-serif",
//           opacity: busy ? 0.6 : 1,
//         }}
//       >
//         <i className="fi fi-rr-play" aria-hidden="true" style={{ fontSize: '13px' }} />
//         <span>شاهد إعلاناً قصيراً وتوقّف عن رؤية الإعلانات البينية لساعة</span>
//       </button>
//       {message && (
//         <p
//           className="text-xs text-center mt-2 px-4"
//           style={{ fontFamily: "'Cairo', sans-serif", color: '#8B5A2B' }}
//         >
//           {message}
//         </p>
//       )}
//     </div>
//   );
// }
//
// export default RewardedAdButton;
//