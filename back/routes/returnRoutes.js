// ─── routes/returnRoutes.js ───────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getReturns, getReturnById,
  createReturn, updateReturn,
  approveReturn, rejectReturn,
} = require('../controllers/returnController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get ('/',            protect,            getReturns);
router.get ('/:id',         protect,            getReturnById);
router.post('/',            protect,            createReturn);
router.put ('/:id',         protect,            updateReturn);
router.put ('/:id/approve', protect, adminOnly, approveReturn);
router.put ('/:id/reject',  protect, adminOnly, rejectReturn);

module.exports = router;
