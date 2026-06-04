-- Migration: 20260604000000_receipt_number_serializable_note
-- ✅ FIX: createPayment + updatePayment بقوا يعملوا فحص receiptNumber
--         داخل $transaction بـ isolationLevel: 'Serializable'
--         لمنع race condition لو طلبين وصلوا بنفس الوقت
--
-- الـ unique index موجود بالفعل من migration الأولى:
-- CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");
--
-- الـ DB بيوفر safety net لكن الـ Serializable transaction بتوفر
-- error message واضحة قبل الوصول للـ DB constraint

SELECT 1; -- no-op: no schema change needed
