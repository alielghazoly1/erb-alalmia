// ─── routes/transferRoutes.js ─────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getTransfers, getTransferById, checkDocNumber,
  createTransfer, updateTransfer,
  approveTransfer, rejectTransfer,
  deleteTransfer, reverseAndDeleteTransfer,
} = require('../controllers/transferController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ⚠️ الثابتة قبل /:id
router.get   ('/check-doc',            protect,            checkDocNumber);
router.get   ('/',                     protect,            getTransfers);
router.get   ('/:id',                  protect,            getTransferById);
router.post  ('/',                     protect,            createTransfer);
router.put   ('/:id',                  protect,            updateTransfer);
router.put   ('/:id/approve',          protect, adminOnly, approveTransfer);
router.put   ('/:id/reject',           protect, adminOnly, rejectTransfer);
router.delete('/:id',                  protect, adminOnly, deleteTransfer);
router.delete('/:id/reverse-delete',   protect, adminOnly, reverseAndDeleteTransfer);

module.exports = router;
