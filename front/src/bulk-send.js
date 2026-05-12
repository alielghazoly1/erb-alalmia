const axios = require('axios');

// ================================
// 🔗 API URL
// ================================
const API_URL = 'http://192.168.1.122:5000/api/customers';

// ================================
// 🔐 التوكن (JWT)
// ================================
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTYyMmE2Y2U2ZGQ5MTUxYTk3MTlhMCIsImlhdCI6MTc3Njk4MjUxMSwiZXhwIjoxNzc5NTc0NTExfQ.4Ci_MC53z_oL8Lsdspb3BFmETMF1T_MO23eoktMC2cM';

// ================================
// ⚙️ إعدادات الأداء
// ================================
const TOTAL = 10000;
const BATCH_SIZE = 5;
const DELAY_MS = 300;
const MAX_RETRY = 3;

// ================================
// 🧪 توليد بيانات العملاء
// ================================
const customers = Array.from({ length: TOTAL }, (_, i) => ({
  name: 'Customer ' + i,
  code: 3000 + i,
  phone: '',
  address: '',
  type: 'credit',
  initialBalance: 1000000,
}));

// ================================
// ⏱️ تأخير بين العمليات
// ================================
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ================================
// 🔁 إرسال مع Retry + Auth
// ================================
const sendWithRetry = async (customer, retry = 0) => {
  try {
    // إرسال الطلب مع التوكن
    await axios.post(API_URL, customer, {
      headers: {
        Authorization: `Bearer ${TOKEN}`, // 🔐 أهم سطر هنا
        'Content-Type': 'application/json',
      },
    });

    return true;
  } catch (err) {
    if (retry < MAX_RETRY) {
      console.log(`🔄 Retry ${retry + 1} for ${customer.code}`);
      return sendWithRetry(customer, retry + 1);
    }

    console.log(`❌ Failed ${customer.code}`);
    return false;
  }
};

// ================================
// 🚀 التشغيل الرئيسي
// ================================
const run = async () => {
  let success = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const chunk = customers.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (c) => {
        const ok = await sendWithRetry(c);
        if (ok) success++;
      }),
    );

    const progress = Math.round(((i + BATCH_SIZE) / TOTAL) * 100);

    console.log(`📦 Batch ${i / BATCH_SIZE + 1} | Progress: ${progress}%`);

    await sleep(DELAY_MS);
  }

  console.log('\n🔥 DONE');
  console.log(`✔ Success: ${success}`);
  console.log(`❌ Failed: ${TOTAL - success}`);
};

run();
