// ─── controllers/paymentController.js ────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, n } = require('../utils/decimalHelper');
const { audit }      = require('../utils/auditHelper');
const { recordPayment, deleteTreasuryEntries } = require('../utils/treasuryHelper');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * يرمي error بـ code مخصوص عشان errorMiddleware يعرف يعالجه
 */
const rcptError = (receiptNumber) =>
  Object.assign(
    new Error(`رقم الوصل "${receiptNumber}" موجود بالفعل`),
    { code: 'REC_DUP', statusCode: 409 },
  );

// ── getPayments ───────────────────────────────────────────────────────────────

const getPayments = async (req, res) => {
  try {
    const { customerId, supplierId, seasonId, type } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;
    if (seasonId)   where.seasonId   = seasonId;
    if (type)       where.type       = type;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        season:    { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json(payments.map(n));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── checkReceiptNumber ────────────────────────────────────────────────────────

const checkReceiptNumber = async (req, res) => {
  try {
    const { receiptNumber, excludeId } = req.query;
    if (!receiptNumber?.trim()) return res.json({ exists: false });

    const where = { receiptNumber: receiptNumber.trim() };
    if (excludeId) where.id = { not: excludeId };

    const exists = await prisma.payment.findFirst({ where });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── createPayment ─────────────────────────────────────────────────────────────
// ✅ FIX: كل العملية داخل $transaction بـ Serializable
//   — يمنع race condition لو طلبين بنفس receiptNumber وصلوا في نفس اللحظة
//   — لو DB unique constraint انكسرت (P2002) بترجع 409 واضحة

const createPayment = async (req, res) => {
  try {
    const {
      type,
      customerId, customerCode, customerName,
      supplierId, supplierCode, supplierName,
      amount, paymentMethod,
      cashAmount, instapayAmount,
      notes, reference,
      receiptNumber,
      date, seasonId,
    } = req.body;

    // ── أتنفذ كلها في transaction واحدة ─────────────────────────────────────
    const payment = await prisma.$transaction(async (tx) => {
      // ✅ فحص التكرار داخل الـ transaction — يمنع race condition
      if (receiptNumber?.trim()) {
        const exists = await tx.payment.findFirst({
          where: { receiptNumber: receiptNumber.trim() },
          select: { id: true },
        });
        if (exists) throw rcptError(receiptNumber.trim());
      }

      const created = await tx.payment.create({
        data: {
          type,
          customerId:     customerId     || null,
          customerCode:   customerCode   || null,
          customerName:   customerName   || null,
          supplierId:     supplierId     || null,
          supplierCode:   supplierCode   || null,
          supplierName:   supplierName   || null,
          amount:         safeNum(amount),
          paymentMethod:  paymentMethod  || 'cash',
          cashAmount:     safeNum(cashAmount)     || 0,
          instapayAmount: safeNum(instapayAmount) || 0,
          receiptNumber:  receiptNumber?.trim()   || null,
          notes,
          reference,
          date:           date ? new Date(date) : new Date(),
          seasonId,
          createdById:    req.user.id,
        },
      });

      // ✅ تسجيل في الخزنة داخل نفس الـ transaction
      await recordPayment(created, req.user, tx);

      // ✅ تسجيل في كشف الصندوق داخل نفس الـ transaction
      if (
        type === 'customer_payment' &&
        paymentMethod === 'cash' &&
        safeNum(cashAmount) > 0
      ) {
        await tx.cashRegister.create({
          data: {
            userId:          req.user.id,
            userName:        req.user.name,
            type:            'payment_in',
            direction:       1,
            cashAmount:      safeNum(cashAmount),
            referenceId:     created.id,
            referenceModel:  'Payment',
            referenceNumber: created.receiptNumber,
            customerId:      customerId || null,
            customerName:    customerName || null,
            seasonId:        seasonId || null,
            date:            created.date,
          },
        });
      }

      return created;
    }, { isolationLevel: 'Serializable' });

    // الـ audit خارج الـ transaction عشان فشله ميرجعش الـ payment
    await audit(req.user, 'payment_created', 'Payment', payment.id, payment.receiptNumber || payment.id);

    res.status(201).json(n(payment));
  } catch (err) {
    // race condition أو unique constraint — أي منهما يعطي 409
    if (err.code === 'REC_DUP' || err.code === 'P2002') {
      return res.status(409).json({ message: err.message || 'رقم الوصل موجود بالفعل' });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── updatePayment ─────────────────────────────────────────────────────────────
// ✅ FIX: فحص receiptNumber + update + treasury داخل transaction واحدة

const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount, paymentMethod,
      cashAmount, instapayAmount,
      notes, reference,
      receiptNumber, date,
    } = req.body;

    const payment = await prisma.$transaction(async (tx) => {
      const old = await tx.payment.findUnique({ where: { id } });
      if (!old) {
        const e = new Error('الدفعة مش موجودة');
        e.statusCode = 404;
        throw e;
      }

      // فحص receiptNumber داخل الـ transaction لمنع race condition
      const newReceipt = receiptNumber?.trim() || null;
      if (newReceipt && newReceipt !== old.receiptNumber) {
        const exists = await tx.payment.findFirst({
          where: { receiptNumber: newReceipt, id: { not: id } },
          select: { id: true },
        });
        if (exists) throw rcptError(newReceipt);
      }

      const data = {};
      if (amount         !== undefined) data.amount         = safeNum(amount);
      if (paymentMethod  !== undefined) data.paymentMethod  = paymentMethod;
      if (cashAmount     !== undefined) data.cashAmount     = safeNum(cashAmount);
      if (instapayAmount !== undefined) data.instapayAmount = safeNum(instapayAmount);
      if (notes          !== undefined) data.notes          = notes;
      if (reference      !== undefined) data.reference      = reference;
      if (receiptNumber  !== undefined) data.receiptNumber  = newReceipt;
      if (date           !== undefined) data.date           = new Date(date);

      const updated = await tx.payment.update({ where: { id }, data });

      // حذف حركات الخزنة القديمة وإعادة التسجيل داخل الـ transaction
      await deleteTreasuryEntries(id, 'Payment', tx);
      await recordPayment(updated, req.user, tx);

      return updated;
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'payment_updated', 'Payment', payment.id, payment.receiptNumber);

    res.json(n(payment));
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ message: err.message });
    if (err.code === 'REC_DUP' || err.code === 'P2002') {
      return res.status(409).json({ message: err.message || 'رقم الوصل موجود بالفعل' });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── deletePayment ─────────────────────────────────────────────────────────────

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.$transaction(async (tx) => {
      const found = await tx.payment.findUnique({ where: { id } });
      if (!found) {
        const e = new Error('الدفعة مش موجودة');
        e.statusCode = 404;
        throw e;
      }
      await deleteTreasuryEntries(id, 'Payment', tx);
      await tx.payment.delete({ where: { id } });
      return found;
    });

    await audit(req.user, 'payment_deleted', 'Payment', payment.id, payment.receiptNumber);

    res.json({ message: 'تم الحذف' });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPayments, checkReceiptNumber, createPayment, updatePayment, deletePayment };
