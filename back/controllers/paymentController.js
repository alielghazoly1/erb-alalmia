// ─── controllers/paymentController.js ────────────────────────────────────────
const prisma            = require('../config/db');
const { audit }         = require('../utils/auditHelper');
const { recordPayment, deleteTreasuryEntries } = require('../utils/treasuryHelper');

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
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const checkReceiptNumber = async (req, res) => {
  try {
    const { receiptNumber, excludeId } = req.query;
    if (!receiptNumber?.trim()) return res.json({ exists: false });
    const where = { receiptNumber };
    if (excludeId) where.id = { not: excludeId };
    const exists = await prisma.payment.findFirst({ where });
    res.json({ exists: !!exists });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

    if (receiptNumber?.trim()) {
      const exists = await prisma.payment.findFirst({ where: { receiptNumber: receiptNumber.trim() } });
      if (exists) return res.status(400).json({ message: `رقم الوصل "${receiptNumber}" موجود بالفعل` });
    }

    const payment = await prisma.payment.create({
      data: {
        type,
        customerId:    customerId || null,
        customerCode:  customerCode || null,
        customerName:  customerName || null,
        supplierId:    supplierId || null,
        supplierCode:  supplierCode || null,
        supplierName:  supplierName || null,
        amount:        Number(amount),
        paymentMethod: paymentMethod || 'cash',
        cashAmount:    Number(cashAmount) || 0,
        instapayAmount:Number(instapayAmount) || 0,
        receiptNumber: receiptNumber?.trim() || null,
        notes,
        reference,
        date:          date ? new Date(date) : new Date(),
        seasonId,
        createdById:   req.user.id,
      },
    });

    // تسجيل في الخزنة
    await recordPayment(payment, req.user);

    // تسجيل في كشف الصندوق
    if (type === 'customer_payment' && paymentMethod === 'cash' && Number(cashAmount) > 0) {
      await prisma.cashRegister.create({
        data: {
          userId:         req.user.id,
          userName:       req.user.name,
          type:           'payment_in',
          direction:      1,
          cashAmount:     Number(cashAmount),
          referenceId:    payment.id,
          referenceModel: 'Payment',
          referenceNumber: payment.receiptNumber,
          customerId:     customerId || null,
          customerName:   customerName || null,
          seasonId:       seasonId || null,
          date:           payment.date,
        },
      });
    }

    await audit(req.user, 'payment_created', 'Payment', payment.id, payment.receiptNumber || payment.id);
    res.status(201).json(n(payment));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updatePayment = async (req, res) => {
  try {
    const { amount, paymentMethod, cashAmount, instapayAmount, notes, reference, receiptNumber, date } = req.body;

    // نحذف حركات الخزنة القديمة وبعدين نعيد تسجيلها
    const old = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'الدفعة مش موجودة' });

    if (receiptNumber?.trim() && receiptNumber !== old.receiptNumber) {
      const exists = await prisma.payment.findFirst({ where: { receiptNumber: receiptNumber.trim(), id: { not: req.params.id } } });
      if (exists) return res.status(400).json({ message: `رقم الوصل "${receiptNumber}" موجود بالفعل` });
    }

    const data = {};
    if (amount         !== undefined) data.amount         = Number(amount);
    if (paymentMethod  !== undefined) data.paymentMethod  = paymentMethod;
    if (cashAmount     !== undefined) data.cashAmount     = Number(cashAmount);
    if (instapayAmount !== undefined) data.instapayAmount = Number(instapayAmount);
    if (notes          !== undefined) data.notes          = notes;
    if (reference      !== undefined) data.reference      = reference;
    if (receiptNumber  !== undefined) data.receiptNumber  = receiptNumber?.trim() || null;
    if (date           !== undefined) data.date           = new Date(date);

    const payment = await prisma.payment.update({ where: { id: req.params.id }, data });

    // حذف الحركات القديمة وإعادة التسجيل
    await deleteTreasuryEntries(payment.id, 'Payment');
    await recordPayment(payment, req.user);

    await audit(req.user, 'payment_updated', 'Payment', payment.id, payment.receiptNumber);
    res.json(n(payment));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ message: 'الدفعة مش موجودة' });

    // حذف حركات الخزنة المرتبطة
    await deleteTreasuryEntries(payment.id, 'Payment');
    await prisma.payment.delete({ where: { id: req.params.id } });

    await audit(req.user, 'payment_deleted', 'Payment', payment.id, payment.receiptNumber);
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const n = (x) => ({ ...x, _id: x.id });

module.exports = { getPayments, checkReceiptNumber, createPayment, updatePayment, deletePayment };
