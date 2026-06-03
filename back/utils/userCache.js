// ─── utils/userCache.js ───────────────────────────────────────────────────────
// ✅ PERF-AUTH-001: كاش للـ user + permissions في الذاكرة
//
// المشكلة:
//   كل request كان بيعمل 2 queries:
//     1. SELECT users WHERE id = $1
//     2. SELECT user_permissions WHERE userId = $1
//   = 200-400ms إضافية على كل طلب
//
// الحل:
//   نخزّن بيانات الـ user في Map بـ TTL = 60 ثانية
//   بعد تغيير الصلاحيات → invalidate فوري
//   بعد تعطيل المستخدم → invalidate فوري
//   باقي الوقت → من الذاكرة (< 1ms)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const TTL_MS   = 60 * 1000; // 60 ثانية
const MAX_SIZE = 500;        // حد أقصى للمستخدمين المخزّنين

/** @type {Map<string, { data: object, expiresAt: number }>} */
const store = new Map();

/**
 * يجيب user من الكاش أو يجلبه من DB ويخزّنه
 * @param {string} userId
 * @param {() => Promise<object>} fetchFn - الـ function اللي تجيب اليوزر من DB
 * @returns {Promise<object|null>}
 */
const getUser = async (userId, fetchFn) => {
  const cached = store.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const data = await fetchFn();
  if (!data) {
    store.delete(userId);
    return null;
  }

  // لو الكاش امتلأ احذف الأقدم
  if (store.size >= MAX_SIZE) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }

  store.set(userId, { data, expiresAt: Date.now() + TTL_MS });
  return data;
};

/**
 * يمسح كاش مستخدم معين فوراً
 * يُستخدم بعد تحديث الصلاحيات أو تعطيل المستخدم
 * @param {string} userId
 */
const invalidateUser = (userId) => {
  store.delete(userId);
};

/** يمسح كل الكاش (مثلاً عند تغيير إعدادات عامة) */
const invalidateAll = () => store.clear();

/** إحصائيات للـ debugging */
const stats = () => ({ size: store.size, maxSize: MAX_SIZE, ttlSeconds: TTL_MS / 1000 });

module.exports = { getUser, invalidateUser, invalidateAll, stats };
