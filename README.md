# كورة بلس — Football Live Platform

## الملفات
- index.html
- style.css
- app.js
- api.js
- worker.js

## التشغيل على Cloudflare
1. أنشئ Cloudflare Worker وضع محتوى `worker.js`.
2. أضف Secret باسم `FOOTBALL_API_KEY` وضع فيه مفتاح API-Football.
3. اجعل نفس الـWorker/المشروع يخدم ملفات الواجهة، أو انشر الملفات الثابتة على نفس النطاق.
4. يجب أن تكون الواجهة قادرة على الوصول إلى `/api/*`.
5. لا تضع المفتاح في `index.html` أو `app.js` أو أي ملف Frontend.

## ملاحظات API-Football
- base API: https://v3.football.api-sports.io/
- fixtures/events للبيانات الحية تحتاج تحديثًا متكررًا.
- statistics تُعامل هنا بمدة Cache أطول من live fixtures.
- standings/leagues/teams/players لها Cache أطول لتقليل الاستهلاك.
- إذا كان الـAPI لا يوفر بيانات endpoint معين للبطولة/الموسم، يعرض الموقع Empty State بدل بيانات وهمية.

## مهم
المشروع يستخدم REST API فعليًا عبر Cloudflare Worker. يجب ضبط Secret قبل أن تظهر البيانات.
