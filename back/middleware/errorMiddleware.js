// ─── middleware/errorMiddleware.js ────────────────────────────────────────────

const notFound = (req, res, next) => {
  const error = new Error(`المسار غير موجود — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(400).json({
      message: `القيمة موجودة بالفعل (${err.meta?.target?.join(', ')})`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'السجل غير موجود' });
  }

  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
