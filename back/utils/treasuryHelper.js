// ─── utils/treasuryHelper.js ─────────────────────────────────────────────────
// متوافق مع الـ schema الجديدة:
//   - prisma.treasuryEntry
//   - TreasuryType: cash | bank (كان admin | bank)
//   - TreasuryEntryType: القيم الجديدة الكاملة
//   - direction: +1 | -1
// ─────────────────────────────────────────────────────────────────────────────
const prisma = require('../config/db');

const recordSaleInvoice = async (invoice, user) => {
  const base = {
    referenceId: invoice.id, referenceModel: 'SaleInvoice',
    referenceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId || null, customerName: invoice.customerName || null,
    seasonId: invoice.seasonId || null, date: invoice.date, userId: user.id,
  };
  const entries = [];
  const m = invoice.paymentMethod;
  if (m === 'cash' && invoice.cashAmount > 0)
    entries.push({ ...base, treasury: 'cash', type: 'sale_cash', amount: invoice.cashAmount, direction: 1, paymentMethod: 'cash' });
  else if (m === 'instapay' && invoice.instapayAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank', amount: invoice.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  else if (m === 'transfer' && invoice.paidAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank', amount: invoice.paidAmount, direction: 1, paymentMethod: 'transfer' });
  else if (m === 'check' && invoice.paidAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'sale_bank', amount: invoice.paidAmount, direction: 1, paymentMethod: 'check' });
  else if (m === 'mixed') {
    if (invoice.cashAmount > 0)
      entries.push({ ...base, treasury: 'cash', type: 'sale_cash', amount: invoice.cashAmount, direction: 1, paymentMethod: 'cash' });
    if (invoice.instapayAmount > 0)
      entries.push({ ...base, treasury: 'bank', type: 'sale_bank', amount: invoice.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  }
  if (entries.length) await prisma.treasuryEntry.createMany({ data: entries });
};

const recordPayment = async (payment, user) => {
  if (payment.type !== 'customer_payment') return;
  const base = {
    referenceId: payment.id, referenceModel: 'Payment',
    referenceNumber: payment.receiptNumber || payment.id.slice(-6),
    customerId: payment.customerId || null, customerName: payment.customerName || null,
    seasonId: payment.seasonId || null, date: payment.date, userId: user.id,
  };
  const m = payment.paymentMethod;
  const entries = [];
  if (m === 'cash')
    entries.push({ ...base, treasury: 'cash', type: 'payment_in_cash', amount: payment.amount, direction: 1, paymentMethod: 'cash' });
  else if (['instapay','transfer','check'].includes(m))
    entries.push({ ...base, treasury: 'bank', type: 'payment_in_bank', amount: payment.amount, direction: 1, paymentMethod: m });
  else if (m === 'mixed') {
    if (payment.cashAmount > 0)
      entries.push({ ...base, treasury: 'cash', type: 'payment_in_cash', amount: payment.cashAmount, direction: 1, paymentMethod: 'cash' });
    if (payment.instapayAmount > 0)
      entries.push({ ...base, treasury: 'bank', type: 'payment_in_bank', amount: payment.instapayAmount, direction: 1, paymentMethod: 'instapay' });
  }
  if (entries.length) await prisma.treasuryEntry.createMany({ data: entries });
};

const recordReturn = async (returnInv, user) => {
  if (returnInv.type !== 'customer_return') return;
  if (returnInv.refundMethod === 'none') return;
  const base = {
    referenceId: returnInv.id, referenceModel: 'ReturnInvoice',
    referenceNumber: returnInv.invoiceNumber,
    customerId: returnInv.customerId || null, customerName: returnInv.customerName || null,
    seasonId: returnInv.seasonId || null, date: returnInv.date, userId: user.id,
  };
  const entries = [];
  if (['cash','mixed'].includes(returnInv.refundMethod) && returnInv.refundCashAmount > 0)
    entries.push({ ...base, treasury: 'cash', type: 'return_in_cash', amount: returnInv.refundCashAmount, direction: -1, paymentMethod: 'cash' });
  if (['bank','mixed'].includes(returnInv.refundMethod) && returnInv.refundBankAmount > 0)
    entries.push({ ...base, treasury: 'bank', type: 'return_in_bank', amount: returnInv.refundBankAmount, direction: -1, paymentMethod: 'transfer' });
  if (entries.length) await prisma.treasuryEntry.createMany({ data: entries });
};

const deleteTreasuryEntries = async (referenceId, referenceModel) => {
  await prisma.treasuryEntry.deleteMany({ where: { referenceId, referenceModel } });
};

module.exports = { recordSaleInvoice, recordPayment, recordReturn, deleteTreasuryEntries };
