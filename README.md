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


## Important frontend fix
app.js now uses api.js via dynamic import. Automatic refresh no longer clears existing matches, and a temporary empty response cannot erase the last successful data for the same date.


## وضع API المجاني فقط
هذا الإصدار مصمم للاستخدام مع الخطة المجانية فقط:
- لا يوجد Retry تلقائي لطلبات API الفاشلة، لأن كل محاولة إضافية قد تستهلك من الحصة.
- Cache للمباريات لمدة 30 دقيقة.
- تحديث تلقائي للمباريات كل 30 دقيقة فقط.
- الأحداث والإحصائيات والتشكيلات لها Cache أطول ولا يتم طلبها إلا عند الحاجة.
- البطولات والفرق واللاعبون والترتيب يتم تخزينها لفترات أطول لتقليل الاستهلاك.
- عند فشل API يحتفظ الموقع بآخر بيانات ناجحة بدل مسح المباريات.
- لا توجد بيانات وهمية.

ملاحظة: حدود الخطة المجانية يفرضها مزود API نفسه. هذا التصميم يقلل الاستهلاك ولا يتجاوز حدود المزود.
