# 🚀 CEO System — MongoDB → PostgreSQL + Prisma

> تحويل احترافي كامل من **MongoDB / Mongoose** إلى **PostgreSQL / Prisma ORM**  
> الـ Frontend (React + Redux) لم يتغير — نفس الـ API routes، نفس الـ response format

---

## 📁 هيكل المشروع

```
project/
├── back/          ← الباك القديم (MongoDB) — للمرجع فقط
├── new-back/      ← ✅ الباك الجديد (PostgreSQL + Prisma)
└── front/         ← الفرونت (React) — لم يتغير
```

---

## ⚡ خطوات التشغيل من الصفر

### 1. تثبيت PostgreSQL

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew install postgresql@16
brew services start postgresql@16

# Windows — نزّل من https://www.postgresql.org/download/windows/
```

### 2. إنشاء قاعدة البيانات

```bash
sudo -u postgres psql

-- داخل psql:
CREATE USER ceo_user WITH PASSWORD 'your_strong_password';
CREATE DATABASE ceo_db OWNER ceo_user;
GRANT ALL PRIVILEGES ON DATABASE ceo_db TO ceo_user;
\q
```

### 3. إعداد ملف البيئة

```bash
cd new-back
cp .env .env.local   # أو عدّل مباشرة
```

عدّل `.env`:
```env
DATABASE_URL="postgresql://ceo_user:your_strong_password@localhost:5432/ceo_db?schema=public"
JWT_SECRET=your_super_secret_key_change_this_in_production
FRONTEND_URL=http://localhost:3000
PORT=5000
```

### 4. تثبيت الـ dependencies

```bash
cd new-back
npm install
```

### 5. توليد Prisma Client + تطبيق الـ Schema

```bash
# توليد الـ Prisma Client من الـ schema
npm run db:generate

# إنشاء أول migration وتطبيقها على الـ DB
npm run db:migrate
# ← هيطلب منك اسم للـ migration، اكتب مثلاً: init
```

### 6. Seed البيانات الأولية

```bash
npm run db:seed
```

هيعمل:
- ✅ **Admin user**: username: `admin` | password: `admin123`
- ✅ **موسم افتراضي** للسنة الحالية  
- ✅ **Counters** لأرقام الفواتير

> ⚠️ **غيّر كلمة المرور فوراً بعد أول تسجيل دخول!**

### 7. تشغيل السيرفر

```bash
# Development
npm run dev

# Production
npm start
```

---

## 🗄️ إدارة قاعدة البيانات

```bash
# فتح Prisma Studio (واجهة بصرية للـ DB)
npm run db:studio

# إنشاء migration جديد بعد تعديل الـ schema
npm run db:migrate

# تطبيق الـ migrations على production
npm run db:migrate:prod

# push الـ schema مباشرة بدون migration (للتطوير السريع)
npm run db:push
```

---

## 🔄 الفروق الجوهرية بين النسختين

| الجانب | MongoDB (قديم) | PostgreSQL + Prisma (جديد) |
|--------|---------------|---------------------------|
| **الـ ID** | `_id` (ObjectId) | `id` (UUID) — مع إرجاع `_id` للتوافق |
| **الـ Connection** | `mongoose.connect()` | Prisma Client singleton |
| **الـ Models** | Mongoose Schemas | Prisma Schema (`schema.prisma`) |
| **الـ Queries** | `Model.find()`, `.aggregate()` | `prisma.model.findMany()`, `.groupBy()` |
| **الـ Relations** | Manual refs + populate | Foreign Keys حقيقية + include |
| **الـ Stock** | Object nested في Document | JSON column في PostgreSQL |
| **الـ Transactions** | `session.withTransaction()` | `prisma.$transaction()` |
| **الـ Counters** | Counter Model | Counter Table مع atomic upsert |
| **الـ Errors** | Mongoose errors | Prisma error codes (P2002, P2025) |

---

## 🏗️ هيكل الكود الجديد

```
new-back/
├── prisma/
│   ├── schema.prisma      ← كل الـ models والـ relations
│   └── seed.js            ← بيانات أولية (admin + season + counters)
├── config/
│   └── db.js              ← Prisma Client singleton
├── controllers/           ← نفس الـ controllers القديمة بـ Prisma
│   ├── authController.js
│   ├── saleController.js
│   ├── purchaseController.js
│   ├── returnController.js
│   ├── customerController.js
│   ├── supplierController.js
│   ├── paymentController.js
│   ├── transferController.js
│   ├── manufacturingController.js
│   ├── seasonController.js
│   ├── itemController.js
│   ├── reportController.js
│   ├── priceListController.js
│   ├── Auditcontroller.js
│   ├── Cashregistercontroller.js
│   └── Workercontroller.js
├── routes/                ← نفس الـ routes تماماً
├── middleware/
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   └── cacheInvalidator.js
├── utils/
│   ├── counterHelper.js   ← بديل Counter Model
│   ├── auditHelper.js
│   ├── treasuryHelper.js
│   ├── customerCache.js
│   └── priceListCache.js
├── server.js
├── package.json
├── vercel.json
└── .env
```

---

## 🔑 نقاط مهمة في التحويل

### الـ `_id` و الـ `id`
الباك الجديد بيستخدم UUID بدل ObjectId، لكن كل response بيرجع `_id` مع `id` للتوافق مع الفرونت:
```javascript
const n = (x) => ({ ...x, _id: x.id });
```

### المخزون (Stock)
مخزّن كـ **JSON column** في PostgreSQL:
```json
{
  "ramses":  { "quantity": 10, "weight": 150.5 },
  "october": { "quantity": 5,  "weight": 75.2  }
}
```

### الـ Counters (أرقام الفواتير)
```javascript
// بدل Counter.findByIdAndUpdate من Mongoose
await prisma.counter.upsert({
  where:  { name: 'SAL' },
  create: { name: 'SAL', value: 1 },
  update: { value: { increment: 1 } },
});
// → SAL-00001, SAL-00002, ...
```

### Prisma Transactions
```javascript
// بدل Mongoose sessions
await prisma.$transaction([
  prisma.item.update({ where: { id }, data: { stock } }),
  prisma.stockMovement.create({ data: movement }),
]);
```

### Error Handling
```javascript
// P2002 = Unique constraint violation (زي duplicate key في Mongoose)
if (err.code === 'P2002') return res.status(400).json({ message: 'القيمة موجودة بالفعل' });

// P2025 = Record not found (زي null من findById)
if (err.code === 'P2025') return res.status(404).json({ message: 'السجل غير موجود' });
```

---

## 🌐 الـ Deploy على Vercel

### Backend
1. ارفع الـ `new-back` على Vercel
2. في Environment Variables أضف:
   - `DATABASE_URL` → connection string من Supabase / Neon / Railway
   - `JWT_SECRET` → مفتاح قوي
   - `FRONTEND_URL` → رابط الفرونت
3. في Build Command: `npx prisma generate && npx prisma migrate deploy`

### Frontend
1. ارفع الـ `front` على Vercel
2. في Environment Variables أضف:
   - `REACT_APP_API_URL` → رابط الباك `/api`

---

## 🗃️ PostgreSQL Cloud (اختار واحد)

| الخدمة | Free Tier | مزايا |
|--------|-----------|-------|
| **[Neon](https://neon.tech)** | ✅ 512MB | الأسرع مع Vercel |
| **[Supabase](https://supabase.com)** | ✅ 500MB | واجهة جميلة |
| **[Railway](https://railway.app)** | ✅ $5 credit | سهل جداً |
| **[Aiven](https://aiven.io)** | ✅ 1 node | موثوق |

---

## 🛠️ Troubleshooting

### مشكلة `P1001` - Can't reach database
```bash
# تأكد إن postgres شغال
sudo systemctl status postgresql

# تأكد من الـ DATABASE_URL
psql "postgresql://user:pass@localhost:5432/ceo_db"
```

### مشكلة `P3006` - Migration failed
```bash
# reset الـ DB (⚠️ هيمسح البيانات)
npx prisma migrate reset

# ثم seed من تاني
npm run db:seed
```

### مشكلة `P2002` - Unique constraint
راجع إن الـ `code` أو `username` مش موجود قبل كده.

### إعادة توليد الـ Prisma Client بعد تعديل الـ schema
```bash
npm run db:generate
```

---

## 📞 ملاحظات نهائية

- ✅ **كل الـ API endpoints نفسها تماماً** — الفرونت مش محتاج أي تعديل
- ✅ **نفس الـ response format** — `_id` موجود في كل response للتوافق
- ✅ **Cache محفوظ** — in-memory cache للعملاء وقوائم الأسعار
- ✅ **Treasury system** محوّل كامل لـ Prisma
- ✅ **Audit logs** شغالة
- ✅ **Stock movements** شغالة مع نفس المنطق
- ⚠️ **لا ترفع `.env`** على GitHub — استخدم environment variables في الـ hosting
#   b a c k  
 