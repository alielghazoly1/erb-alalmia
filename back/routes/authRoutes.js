// ─── routes/authRoutes.js ─────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  login, logout, getMe,
  createUser, getUsers, updateUser, deleteUser,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/login',       login);
router.post('/logout',      logout);
router.get ('/me',          protect,            getMe);
router.get ('/users',       protect, adminOnly, getUsers);
router.post('/users',       protect, adminOnly, createUser);
router.put ('/users/:id',   protect, adminOnly, updateUser);
router.delete('/users/:id', protect, adminOnly, deleteUser);

module.exports = router;
