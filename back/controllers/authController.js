// ─── controllers/authController.js ───────────────────────────────────────────
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

const TOKEN_EXPIRES_IN = '30d';
const COOKIE_MAX_AGE   = 30 * 24 * 60 * 60 * 1000;

// الـ Permissions اللي بنعرضها للفرونت (مختصرة من الـ enum الكبير)
const FRONT_PERMISSIONS = ['allowNegativeSale', 'canEditInvoice'];

// mapping من الـ keys القديمة للـ enum الجديد في DB
const PERM_MAP = {
  allowNegativeSale: 'sale_allow_negative',
  canEditInvoice:    'sale_edit',
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

const setAuthCookie = (res, token) => {
  res.cookie('authToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.ELECTRON === 'true' ? 'none' : 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie('authToken', { httpOnly: true, sameSite: 'lax', path: '/' });
};

/**
 * يحوّل user من DB لشكل آمن للفرونت.
 * user.permissions = UserPermission[] (من Prisma relation)
 */
const serializeUser = (user) => {
  // permissions هي Array من { permission: string, granted: boolean }
  const permsArr = Array.isArray(user.permissions) ? user.permissions : [];

  const permissionsMap = Object.fromEntries(
    FRONT_PERMISSIONS.map((frontKey) => {
      // الأدمن عنده كل الصلاحيات تلقائياً ما عدا allowNegativeSale (بتيجي من DB)
      if (user.role === 'admin' && frontKey !== 'allowNegativeSale') {
        return [frontKey, true];
      }
      const dbKey  = PERM_MAP[frontKey];
      const record = permsArr.find(p => p.permission === dbKey);
      return [frontKey, record ? record.granted === true : false];
    })
  );

  return {
    _id:       user.id,
    name:      user.name,
    username:  user.username,
    role:      user.role,
    warehouse: user.scope,   // ← الحقل في DB اسمه scope وليس warehouse
    isActive:  user.isActive,
    permissions: permissionsMap,
  };
};

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'أدخل اسم المستخدم وكلمة المرور' });

    const user = await prisma.user.findUnique({
      where:  { username: username.toLowerCase() },
      include: { permissions: { select: { permission: true, granted: true } } },
    });

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غلط' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غلط' });

    const token = generateToken(user.id);
    setAuthCookie(res, token);
    res.json(serializeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
const logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'تم تسجيل الخروج' });
};

// ── Get Me ────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.user.id },
      include: { permissions: { select: { permission: true, granted: true } } },
    });
    if (!user) return res.status(404).json({ message: 'المستخدم مش موجود' });
    res.json(serializeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Create User ───────────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, username, password, role, warehouse, permissions } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ message: 'الاسم واسم المستخدم وكلمة المرور مطلوبين' });

    const exists = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (exists) return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });

    const hashed = await bcrypt.hash(password, 10);

    // scope بيقابل warehouse في الفرونت
    const scope = warehouse || 'both';

    // أنشئ الـ user بدون permissions (هنضيفها بعدين كـ UserPermission records)
    const user = await prisma.user.create({
      data: { name, username: username.toLowerCase(), password: hashed, role, scope },
      include: { permissions: { select: { permission: true, granted: true } } },
    });

    // لو فيه permissions مرسلة من الفرونت، نحولها لـ UserPermission records
    if (permissions && typeof permissions === 'object') {
      const permRecords = [];
      for (const [frontKey, val] of Object.entries(permissions)) {
        const dbKey = PERM_MAP[frontKey];
        if (dbKey) {
          permRecords.push({
            userId:     user.id,
            permission: dbKey,
            granted:    Boolean(val),
          });
        }
      }
      if (permRecords.length > 0) {
        await prisma.userPermission.createMany({ data: permRecords });
      }
    }

    // أعد جلب الـ user مع الصلاحيات
    const freshUser = await prisma.user.findUnique({
      where:   { id: user.id },
      include: { permissions: { select: { permission: true, granted: true } } },
    });

    res.status(201).json(serializeUser(freshUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get All Users ─────────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { permissions: { select: { permission: true, granted: true } } },
    });
    res.json(users.map(serializeUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update User ───────────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'المستخدم مش موجود' });

    const data = {};
    if (req.body.name      !== undefined) data.name     = req.body.name;
    if (req.body.warehouse !== undefined) data.scope    = req.body.warehouse; // warehouse→scope
    if (req.body.scope     !== undefined) data.scope    = req.body.scope;
    if (req.body.isActive  !== undefined) data.isActive = req.body.isActive;
    if (req.body.role      !== undefined) data.role     = req.body.role;
    if (req.body.password)               data.password  = await bcrypt.hash(req.body.password, 10);

    await prisma.user.update({ where: { id: req.params.id }, data });

    // تحديث الـ permissions لو مرسلة
    if (req.body.permissions && typeof req.body.permissions === 'object') {
      for (const [frontKey, val] of Object.entries(req.body.permissions)) {
        const dbKey = PERM_MAP[frontKey];
        if (!dbKey) continue;
        await prisma.userPermission.upsert({
          where:  { userId_permission: { userId: req.params.id, permission: dbKey } },
          update: { granted: Boolean(val) },
          create: { userId: req.params.id, permission: dbKey, granted: Boolean(val) },
        });
      }
    }

    const updated = await prisma.user.findUnique({
      where:   { id: req.params.id },
      include: { permissions: { select: { permission: true, granted: true } } },
    });
    res.json(serializeUser(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete (soft) User ────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'المستخدم مش موجود' });
    if (user.role === 'admin') return res.status(400).json({ message: 'مينفعش تحذف أدمن' });
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { login, logout, getMe, createUser, getUsers, updateUser, deleteUser };