-- DropIndex
DROP INDEX "manufacturing_orders_seasonId_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "sale_invoices_deletedAt_seasonId_createdAt_idx" ON "sale_invoices"("deletedAt", "seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "sale_invoices_invoiceNumber_idx" ON "sale_invoices"("invoiceNumber");
