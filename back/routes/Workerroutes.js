// ─── routes/Workerroutes.js ───────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getWorkers, getWorkerById,
  createWorker, updateWorker, deleteWorker,
  getWorkerStatement,
  getWorkerOrders,           // ✅ جديد — أوامر بـ pagination منفصل
} = require('../controllers/Workercontroller');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get ('/',                  protect,            getWorkers);
router.get ('/:id',               protect,            getWorkerById);
router.get ('/:id/statement',     protect,            getWorkerStatement);  // summary فقط
router.get ('/:id/orders',        protect,            getWorkerOrders);     // أوامر بـ pagination
router.post('/',                  protect, adminOnly, createWorker);
router.put ('/:id',               protect, adminOnly, updateWorker);
router.delete('/:id',             protect, adminOnly, deleteWorker);

module.exports = router;
