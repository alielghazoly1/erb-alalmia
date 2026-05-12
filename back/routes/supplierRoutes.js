// ─── routes/supplierRoutes.js ─────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getSuppliers, getSupplierByCode, createSupplier,
  updateSupplier, deleteSupplier,
  getSupplierStatement, getSupplierAllSeasons,
  updateSupplierInitialBalance, getSupplierItemStatement,
  getSupplierTimeline,
} = require('../controllers/supplierController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get   ('/',    protect,            getSuppliers);
router.post  ('/',    protect, adminOnly, createSupplier);

// ── routes ثابتة — قبل /:id ───────────────────────────────────────────────────
router.get('/code/:code',                          protect,            getSupplierByCode);
router.get('/:supplierId/statement',               protect,            getSupplierStatement);
router.get('/:supplierId/timeline',                protect,            getSupplierTimeline);
router.get('/:supplierId/all-seasons',             protect,            getSupplierAllSeasons);
router.get('/:supplierId/item/:itemId',            protect,            getSupplierItemStatement);

// ── dynamic CRUD ──────────────────────────────────────────────────────────────
router.put   ('/:id',                  protect, adminOnly, updateSupplier);
router.delete('/:id',                  protect, adminOnly, deleteSupplier);
router.patch ('/:id/initial-balance',  protect, adminOnly, updateSupplierInitialBalance);

module.exports = router;
