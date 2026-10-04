# دليل مراجعة البلاغات (Moderation runbook)

الهدف: مراجعة كل بلاغ خلال **72 ساعة** (مكتوب في شروط الاستخدام). شغّل الاستعلامات من Supabase ← SQL Editor.

## 1) البلاغات المعلّقة
```sql
select id, created_at, reason, reported_username, reported_user_id, reported_content, details
from user_reports
where status = 'pending'
order by created_at;
```

## 2) تاريخ لاعب (كم بلاغ عليه)
```sql
select reason, status, created_at from user_reports
where reported_user_id = '<USER_ID>' order by created_at desc;
```

## 3) الإجراءات
- **تجاهل/غير مخالف:** `update user_reports set status='dismissed', reviewed_at=now() where id=<ID>;`
- **تحذير:** كلّم اللاعب (لو متاح)، وبعدها `status='action_taken', action_taken='warning'`.
- **منع الرسائل:** `update profiles set terms_accepted_at = null where id='<USER_ID>';` — بيمنعه من الإرسال لحد ما يوافق على الشروط تاني (مؤقت). للمنع الدائم احذف الحساب.
- **حذف الحساب (مخالفة جسيمة):** Dashboard ← Authentication ← Users ← Delete user. مباريات الخصوم بتفضل لهم تلقائياً. بعدها: `status='action_taken', action_taken='account_deleted'`.

بعد أي إجراء: `update user_reports set status='action_taken', action_taken='<...>', reviewed_at=now() where id=<ID>;`

## 4) ملاحظات
- البلاغات بتتمسح تلقائياً بعد 180 يوم (الـ cron الليلي `daily-cleanup-and-keepalive`).
- محتوى جنسي يخص قاصرين أو تهديد حقيقي: احذف الحساب فوراً، وبلّغ الجهات المختصة لو لزم.
- الرد على اعتراض مستخدم: على البريد المنشور في الشروط.
