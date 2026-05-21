// ─── utils/treasuryHelper.js ──────────────────────────────────────────────────
// أدوات الخزينة — تسجيل وحذف القيود المحاسبية
// ✅ TX-AWARE: كل دالة تقبل tx (transaction context) اختيارياً
// ✅ FIX: recordReturn يدعم الآن طرق الاسترداد: transfer, check (لم تكن مدعومة)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');

const db = (tx) => tx || prisma;

// ── recordSaleInvoice ─────────────────────────────────────────────────────────
const recordSaleInvoice = async (invoice, user, tx = null) => {
  const client = db(tx);
  const base = {
    referenceId:     invoice.id,
    referenceModel:  'SaleInvoice',
    referenceNumber: invoice.invoiceNumber,
    customerId:      invoice.customerId    || null,
    customerName:    invoice.customerName  || null,
    seasonId:        invoice.seasonId      || null,
    date:            invoice.date,
    userId:          user.id,
  };

  const entries = [];
  const m = invoice.paymentMethod;

  if (m === 'cash' && invoice.cashAmount > 0)
    entries.push({ ...base, treasury: 'cash', type: 'sale_cash',  amount: invoice.cashAmount,     direction: 1, paymentMethod: 'cash' });
  else if (m === 'instapay' && invoice.instapayAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank',  amount: invoice.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  else if (m === 'transfer' && invoice.paidAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank',  amount: invoice.paidAmount,     direction: 1, paymentMethod: 'transfer' });
  else if (m === 'check' && invoice.paidAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank',  amount: invoice.paidAmount,     direction: 1, paymentMethod: 'check' });
  else if (m === 'mixed') {
    if (invoice.cashAmount     > 0) entries.push({ ...base, treasury: 'cash', type: 'sale_cash', amount: invoice.cashAmount,     direction: 1, paymentMethod: 'cash' });
    if (invoice.instapayAmount > 0) entries.push({ ...base, treasury: 'bank', type: 'sale_bank', amount: invoice.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  }

  if (entries.length) await client.treasuryEntry.createMany({ data: entries });
};

// ── recordPayment ─────────────────────────────────────────────────────────────
const recordPayment = async (payment, user, tx = null) => {
  if (payment.type !== 'customer_payment') return;
  const client = db(tx);
  const base = {
    referenceId:     payment.id,
    referenceModel:  'Payment',
    referenceNumber: payment.receiptNumber || payment.id.slice(-6),
    customerId:      payment.customerId    || null,
    customerName:    payment.customerName  || null,
    seasonId:        payment.seasonId      || null,
    date:            payment.date,
    userId:          user.id,
  };

  const m = payment.paymentMethod;
  const entries = [];
  if (m === 'cash')
    entries.push({ ...base, treasury: 'cash', type: 'payment_in_cash', amount: payment.amount, direction: 1, paymentMethod: 'cash' });
  else if (['instapay', 'transfer', 'check'].includes(m))
    entries.push({ ...base, treasury: 'bank', type: 'payment_in_bank', amount: payment.amount, direction: 1, paymentMethod: m });
  else if (m === 'mixed') {
    if (payment.cashAmount     > 0) entries.push({ ...base, treasury: 'cash', type: 'payment_in_cash', amount: payment.cashAmount,     direction: 1, paymentMethod: 'cash' });
    if (payment.instapayAmount > 0) entries.push({ ...base, treasury: 'bank', type: 'payment_in_bank', amount: payment.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  }

  if (entries.length) await client.treasuryEntry.createMany({ data: entries });
};

// ── recordReturn ──────────────────────────────────────────────────────────────
// ✅ FIX: أضفنا دعم لـ 'transfer' و 'check' كطرق استرداد
//         وأضفنا دعم لـ 'mixed' بالتحقق من كلا المبلغين
const recordReturn = async (returnInv, user, tx = null) => {
  if (returnInv.type !== 'customer_return') return;
  const client = db(tx);
  const base = {
    referenceId:     returnInv.id,
    referenceModel:  'ReturnInvoice',
    referenceNumber: returnInv.invoiceNumber,
    customerId:      returnInv.customerId  || null,
    customerName:    returnInv.customerName || null,
    seasonId:        returnInv.seasonId    || null,
    date:            returnInv.date,
    userId:          user.id,
  };

  const entries = [];
  const m             = returnInv.refundMethod;
  const cashAmt       = returnInv.refundCashAmount  || 0;
  const bankAmt       = returnInv.refundBankAmount  || 0;
  // paidAmount هو مجموع ما يُرد للعميل (cash أو bank منفردين)
  const refundTotal   = returnInv.paidAmount || returnInv.totalAmount || 0;

  if (m === 'cash' && cashAmt > 0)
    entries.push({ ...base, treasury: 'cash', type: 'return_out_cash', amount: cashAmt,     direction: -1, paymentMethod: 'cash' });
  else if (m === 'instapay' && bankAmt > 0)
    entries.push({ ...base, treasury: 'bank', type: 'return_out_bank', amount: bankAmt,     direction: -1, paymentMethod: 'instapay' });
  // ✅ FIX: دعم transfer وcheck كطرق استرداد
  else if (m === 'transfer' && (bankAmt > 0 || refundTotal > 0))
    entries.push({ ...base, treasury: 'bank', type: 'return_out_bank', amount: bankAmt || refundTotal, direction: -1, paymentMethod: 'transfer' });
  else if (m === 'check' && (bankAmt > 0 || refundTotal > 0))
    entries.push({ ...base, treasury: 'bank', type: 'return_out_bank', amount: bankAmt || refundTotal, direction: -1, paymentMethod: 'check' });
  else if (m === 'mixed') {
    if (cashAmt > 0) entries.push({ ...base, treasury: 'cash', type: 'return_out_cash', amount: cashAmt, direction: -1, paymentMethod: 'cash' });
    if (bankAmt > 0) entries.push({ ...base, treasury: 'bank', type: 'return_out_bank', amount: bankAmt, direction: -1, paymentMethod: 'instapay' });
  }
  // 'none' أو عميل آجل — مفيش خروج من الخزينة

  if (entries.length) await client.treasuryEntry.createMany({ data: entries });
};

// ── deleteTreasuryEntries ─────────────────────────────────────────────────────
const deleteTreasuryEntries = async (referenceId, referenceModel, tx = null) => {
  const client = db(tx);
  await client.treasuryEntry.deleteMany({ where: { referenceId, referenceModel } });
};

module.exports = {
  recordSaleInvoice,
  recordPayment,
  recordReturn,
  deleteTreasuryEntries,
};
