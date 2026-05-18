/*
  Warnings:

  - You are about to alter the column `minStockQty` on the `items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,3)`.
  - You are about to alter the column `systemQty` on the `stock_adjustment_lines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,3)`.
  - You are about to alter the column `actualQty` on the `stock_adjustment_lines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,3)`.
  - You are about to alter the column `diffQty` on the `stock_adjustment_lines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,3)`.

*/
-- AlterTable
ALTER TABLE "items" ALTER COLUMN "minStockQty" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "stock_adjustment_lines" ALTER COLUMN "systemQty" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "actualQty" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "diffQty" SET DATA TYPE DECIMAL(12,3);

-- CreateTable
CREATE TABLE "customer_season_balances" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_season_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_season_balances" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_season_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_season_balances_seasonId_idx" ON "customer_season_balances"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_season_balances_customerId_seasonId_key" ON "customer_season_balances"("customerId", "seasonId");

-- CreateIndex
CREATE INDEX "supplier_season_balances_seasonId_idx" ON "supplier_season_balances"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_season_balances_supplierId_seasonId_key" ON "supplier_season_balances"("supplierId", "seasonId");

-- AddForeignKey
ALTER TABLE "customer_season_balances" ADD CONSTRAINT "customer_season_balances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_season_balances" ADD CONSTRAINT "customer_season_balances_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_season_balances" ADD CONSTRAINT "supplier_season_balances_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_season_balances" ADD CONSTRAINT "supplier_season_balances_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
