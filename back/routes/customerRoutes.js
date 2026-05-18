// ─── routes/customerRoutes.js ────────────────────────────────────────────────
const router = require('express').Router();
const {
  getCustomers, createCustomer, updateCustomer,
  updateInitialBalance, deleteCustomer,
  getCustomerStatement, getCustomerAllSeasons, getCustomerItemStatement,
  getCustomerTimeline,
} = require('../controllers/customerController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get   ('/',    protect,            getCustomers);
router.post  ('/',    protect, adminOnly, createCustomer);
router.put   ('/:id', protect, adminOnly, updateCustomer);
router.delete('/:id', protect, adminOnly, deleteCustomer);

// ── تعديل الرصيد الابتدائي ────────────────────────────────────────────────────
router.patch('/:id/initial-balance', protect, adminOnly, updateInitialBalance);

// ── كشف الحساب — لازم قبل /:id عشان :customerId ما يتعارضش ─────────────────
router.get('/:customerId/statement',        protect, getCustomerStatement);
router.get('/:customerId/timeline',         protect, getCustomerTimeline);
router.get('/:customerId/all-seasons',      protect, getCustomerAllSeasons);
// router.get('/:customerId/item/:itemId',     protect, getCustomerItemStatement);

module.exports = router;
