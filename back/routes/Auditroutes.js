// ─── routes/Auditroutes.js ────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  getAuditLogs, getAuditUsers, getAuditSummary,
} = require('../controllers/Auditcontroller');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/users',   protect, adminOnly, getAuditUsers);
router.get('/summary', protect, adminOnly, getAuditSummary);
router.get('/',        protect, adminOnly, getAuditLogs);

module.exports = router;
