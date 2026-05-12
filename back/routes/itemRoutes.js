// ─── routes/itemRoutes.js ─────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getItems, getItemById, getItemByCode,
  createItem, updateItem, deleteItem, getItemStock,
} = require('../controllers/itemController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ⚠️ الثابتة قبل /:id دايماً
router.get ('/code/:code',  protect,            getItemByCode);
router.get ('/:id/stock',   protect,            getItemStock);
router.get ('/',            protect,            getItems);
router.get ('/:id',         protect,            getItemById);
router.post('/',            protect, adminOnly, createItem);
router.put ('/:id',         protect, adminOnly, updateItem);
router.delete('/:id',       protect, adminOnly, deleteItem);

module.exports = router;
