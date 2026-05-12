// ─── routes/manufacturingRoutes.js ───────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getOrders, getOrderById,
  createOrder, updateOrder,
  approveOrder, rejectOrder,
  getWorkers, getWorkerReport,
  getSeasons, setSeasonStartNumber,
} = require('../controllers/manufacturingController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ⚠️ الثابتة قبل /:id
router.get ('/workers',                    protect,            getWorkers);
router.get ('/worker/:workerId',           protect,            getWorkerReport);
router.get ('/seasons',                    protect,            getSeasons);
router.put ('/seasons/:seasonId/counter',  protect, adminOnly, setSeasonStartNumber);
router.get ('/',                           protect,            getOrders);
router.get ('/:id',                        protect,            getOrderById);
router.post('/',                           protect,            createOrder);
router.put ('/:id',                        protect,            updateOrder);
router.put ('/:id/approve',               protect, adminOnly, approveOrder);
router.put ('/:id/reject',                protect, adminOnly, rejectOrder);

module.exports = router;
