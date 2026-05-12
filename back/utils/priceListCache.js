// ─── utils/priceListCache.js ──────────────────────────────────────────────────
const TTL_MS = 60 * 1000; // 60 ثانية
const store  = new Map();

const getOrFetch = async (key, fn) => {
  const cached = store.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const data = await fn();
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
  return data;
};

const invalidate = () => store.clear();

module.exports = { getOrFetch, invalidate };
