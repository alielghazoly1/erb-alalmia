// ─── routes/priceListRoutes.js ────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getAllPriceLists, getPriceListByName,
  getItemPrice, getItemPriceWithLastPurchase,
  upsertPriceEntry, reorderItems, deletePriceEntry,
  createPriceList, updatePriceListInfo, getCacheStats,
} = require('../controllers/priceListController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── Static routes — قبل الـ dynamic عشان ما يتعارضوش ───────────────────────
router.get ('/lists',                      protect,            getAllPriceLists);
router.get ('/cache/stats',               protect, adminOnly, getCacheStats);
router.get ('/item-with-purchase/:itemId', protect,            getItemPriceWithLastPurchase);
router.get ('/item/:itemId',              protect,            getItemPrice);

router.post('/lists',    protect, adminOnly, createPriceList);
router.post('/reorder',  protect, adminOnly, reorderItems);
router.post('/',         protect, adminOnly, upsertPriceEntry);

router.put ('/lists/info', protect, adminOnly, updatePriceListInfo);

router.delete('/:id',    protect, adminOnly, deletePriceEntry);

// ── Dynamic — في الآخر دايماً ─────────────────────────────────────────────
router.get('/:listName/items', protect, getPriceListByName);

module.exports = router;
