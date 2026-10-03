/*
 * main.jsx - نقطة الدخول الرئيسية للتطبيق
 * ===================================================
 * هذا الملف هو "بوابة" التطبيق.
 * وظيفته الوحيدة: إيجاد div#root في index.html
 * وحقن مكوّن <App /> بداخله.
 *
 * ReactDOM.createRoot() = طريقة React 18 الحديثة
 * لتهيئة التطبيق (تدعم Concurrent Features)
 * ===================================================
 */
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App.jsx';
import './index.css'; /* استيراد الأنماط العامة */
import '@flaticon/flaticon-uicons/css/regular/rounded.css'; /* أيقونات Flaticon Uicons (نمط regular-rounded) المُستخدَمة داخل الأزرار */
import '@flaticon/flaticon-uicons/css/solid/rounded.css'; /* نمط solid-rounded: للأيقونات المُلوّنة البارزة (بطاقات الإحصائيات وميداليات المتصدرين) */
import '@flaticon/flaticon-uicons/css/brands/all.css'; /* أيقونات العلامات التجارية (fi-brands-*) — زر مشاركة واتساب */

/* البحث عن العنصر div#root في index.html وحقن التطبيق فيه */
ReactDOM.createRoot(document.getElementById('root')).render(
  /*
   * React.StrictMode: وضع التطوير الصارم
   * يُنبّه عن المشاكل المحتملة في وقت التطوير فقط
   * لا يؤثر على الأداء في وضع الإنتاج
   */
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
