// ─── middleware/errorMiddleware.js ────────────────────────────────────────────
'use strict';

const notFound = (req, res, next) => {
  const error = new Error(`المسار غير موجود — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'قيمة';
    return res.status(409).json({ message: `${field} موجود بالفعل` });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'السجل غير موجود' });
  }

  // أخطاء business logic بـ statusCode مخصوص (مثل REC_DUP)
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
