-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'supervisor', 'user', 'viewer');

-- CreateEnum
CREATE TYPE "Warehouse" AS ENUM ('ramses', 'october');

-- CreateEnum
CREATE TYPE "WarehouseScope" AS ENUM ('ramses', 'october', 'both');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('credit', 'cash');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'pending', 'approved', 'suspended', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'credit', 'instapay', 'transfer', 'check', 'mixed');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('customer_payment', 'supplier_payment');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('cash', 'bank', 'credit_note', 'none');

-- CreateEnum
CREATE TYPE "TreasuryType" AS ENUM ('cash', 'bank');

-- CreateEnum
CREATE TYPE "TreasuryEntryType" AS ENUM ('sale_cash', 'sale_bank', 'purchase_cash', 'purchase_bank', 'payment_in_cash', 'payment_in_bank', 'payment_out_cash', 'payment_out_bank', 'return_in_cash', 'return_in_bank', 'return_out_cash', 'return_out_bank', 'expense', 'adjustment');

-- CreateEnum
CREATE TYPE "CashRegisterType" AS ENUM ('sale_cash', 'payment_in', 'payment_out', 'return_in', 'return_out', 'expense', 'adjustment');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('purchase_in', 'sale_out', 'return_in', 'return_out', 'transfer_in', 'transfer_out', 'manufacturing_in', 'manufacturing_out', 'adjustment_add', 'adjustment_sub', 'opening_stock');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('ramses_to_october', 'october_to_ramses');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('customer_return', 'supplier_return');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('sale_create', 'sale_approve', 'sale_edit', 'sale_cancel', 'sale_allow_negative', 'purchase_create', 'purchase_approve', 'purchase_edit', 'purchase_cancel', 'return_create', 'return_approve', 'transfer_create', 'transfer_approve', 'manufacturing_create', 'manufacturing_approve', 'payment_create', 'payment_edit', 'payment_delete', 'report_sales', 'report_purchases', 'report_stock', 'report_treasury', 'report_customers', 'settings_users', 'settings_items', 'settings_suppliers', 'settings_customers', 'settings_seasons', 'settings_price_lists', 'settings_warehouses', 'stock_adjustment', 'treasury_view', 'treasury_manage');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('invoice_created', 'invoice_approved', 'invoice_cancelled', 'invoice_suspended', 'invoice_edited', 'invoice_restored', 'return_created', 'return_approved', 'return_rejected', 'payment_created', 'payment_updated', 'payment_deleted', 'customer_created', 'customer_updated', 'customer_deleted', 'supplier_created', 'supplier_updated', 'supplier_deleted', 'stock_adjustment', 'stock_transfer', 'manufacturing_approved', 'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deactivated', 'season_created', 'season_activated', 'season_closed', 'treasury_entry_created', 'treasury_adjustment');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "scope" "WarehouseScope" NOT NULL DEFAULT 'both',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" "Permission" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" VARCHAR(300),
    "ipAddress" VARCHAR(45),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isManufacturing" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_counters" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "startFrom" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "season_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_counters" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "global_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "phone2" VARCHAR(20),
    "address" VARCHAR(300),
    "type" "CustomerType" NOT NULL DEFAULT 'credit',
    "creditLimit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "phone2" VARCHAR(20),
    "address" VARCHAR(300),
    "taxNumber" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100),
    "subCategory" VARCHAR(100),
    "unit" VARCHAR(30) NOT NULL DEFAULT 'كرتون',
    "defaultWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lastPurchasePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lastSalePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "minStockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRawMaterial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_stocks" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "warehouse" "Warehouse" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "weight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "seasonId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "scope" "WarehouseScope" NOT NULL DEFAULT 'ramses',
    "phone" VARCHAR(20),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_invoices" (
    "id" UUID NOT NULL,
    "invoiceNumber" VARCHAR(30) NOT NULL,
    "docNumber" VARCHAR(50) NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" UUID NOT NULL,
    "customerCode" VARCHAR(30) NOT NULL,
    "customerName" VARCHAR(200) NOT NULL,
    "warehouse" "Warehouse" NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'credit',
    "cashAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "instapayAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "seasonId" UUID,
    "notes" TEXT,
    "suspendReason" TEXT,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "editedById" UUID,
    "editedAt" TIMESTAMPTZ(6),
    "editNotes" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL,
    "invoiceNumber" VARCHAR(30) NOT NULL,
    "docNumber" VARCHAR(50) NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" UUID NOT NULL,
    "supplierCode" VARCHAR(30) NOT NULL,
    "supplierName" VARCHAR(200) NOT NULL,
    "warehouse" "Warehouse" NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(15,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "seasonId" UUID,
    "notes" TEXT,
    "suspendReason" TEXT,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "editedById" UUID,
    "editedAt" TIMESTAMPTZ(6),
    "editNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_invoices" (
    "id" UUID NOT NULL,
    "invoiceNumber" VARCHAR(30) NOT NULL,
    "docNumber" VARCHAR(50) NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ReturnType" NOT NULL,
    "customerId" UUID,
    "customerCode" VARCHAR(30),
    "customerName" VARCHAR(200),
    "supplierId" UUID,
    "supplierCode" VARCHAR(30),
    "supplierName" VARCHAR(200),
    "warehouse" "Warehouse" NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "refundMethod" "RefundMethod" NOT NULL DEFAULT 'none',
    "refundCashAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "refundBankAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "originalInvoiceRef" VARCHAR(30),
    "seasonId" UUID,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "return_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "return_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "type" "PaymentType" NOT NULL,
    "customerId" UUID,
    "customerCode" VARCHAR(30),
    "customerName" VARCHAR(200),
    "supplierId" UUID,
    "supplierCode" VARCHAR(30),
    "supplierName" VARCHAR(200),
    "seasonId" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "cashAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "instapayAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "checkAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "receiptNumber" VARCHAR(50),
    "notes" TEXT,
    "reference" VARCHAR(100),
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityIn" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityOut" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "weightIn" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "weightOut" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "warehouse" "Warehouse" NOT NULL,
    "balanceQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "balanceWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reference" VARCHAR(50),
    "referenceModel" VARCHAR(50),
    "referenceId" UUID,
    "seasonId" UUID,
    "createdById" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "refNumber" VARCHAR(30) NOT NULL,
    "warehouse" "Warehouse" NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "seasonId" UUID,
    "createdById" UUID NOT NULL,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" UUID NOT NULL,
    "adjustmentId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "systemQty" DOUBLE PRECISION NOT NULL,
    "systemWeight" DECIMAL(12,3) NOT NULL,
    "actualQty" DOUBLE PRECISION NOT NULL,
    "actualWeight" DECIMAL(12,3) NOT NULL,
    "diffQty" DOUBLE PRECISION NOT NULL,
    "diffWeight" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "transferNumber" VARCHAR(30) NOT NULL,
    "docNumber" VARCHAR(50) NOT NULL,
    "direction" "TransferDirection" NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromWarehouse" "Warehouse" NOT NULL,
    "toWarehouse" "Warehouse" NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "seasonId" UUID,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_orders" (
    "id" UUID NOT NULL,
    "orderNumber" VARCHAR(30) NOT NULL,
    "docNumber" VARCHAR(50) NOT NULL DEFAULT '',
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouse" "Warehouse" NOT NULL DEFAULT 'ramses',
    "workerId" UUID,
    "workerName" VARCHAR(120),
    "notes" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "seasonId" UUID,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_raw_materials" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "manufacturing_raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_outputs" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "manufacturing_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_entries" (
    "id" UUID NOT NULL,
    "treasury" "TreasuryType" NOT NULL,
    "type" "TreasuryEntryType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "direction" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod",
    "referenceId" UUID,
    "referenceModel" VARCHAR(50),
    "referenceNumber" VARCHAR(50),
    "customerId" UUID,
    "customerName" VARCHAR(200),
    "supplierId" UUID,
    "supplierName" VARCHAR(200),
    "seasonId" UUID,
    "userId" UUID,
    "notes" TEXT,
    "reversalOf" UUID,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userName" VARCHAR(120) NOT NULL,
    "type" "CashRegisterType" NOT NULL,
    "direction" INTEGER NOT NULL,
    "cashAmount" DECIMAL(15,2) NOT NULL,
    "referenceId" UUID,
    "referenceModel" VARCHAR(50),
    "referenceNumber" VARCHAR(50),
    "customerId" UUID,
    "customerName" VARCHAR(200),
    "seasonId" UUID,
    "notes" TEXT,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "priceListName" VARCHAR(100) NOT NULL,
    "priceListDescription" VARCHAR(300) NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "displayName" VARCHAR(200) NOT NULL,
    "origin" VARCHAR(100) NOT NULL DEFAULT '',
    "unit" VARCHAR(50) NOT NULL DEFAULT '',
    "notes" VARCHAR(500) NOT NULL DEFAULT '',
    "prices" JSONB NOT NULL DEFAULT '[]',
    "defaultPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "itemDisplayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_item_links" (
    "id" UUID NOT NULL,
    "priceListId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,

    CONSTRAINT "price_list_item_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "userName" VARCHAR(120),
    "userRole" VARCHAR(30),
    "action" "AuditAction" NOT NULL,
    "resource" VARCHAR(50),
    "resourceId" UUID,
    "resourceRef" VARCHAR(50),
    "diff" JSONB,
    "meta" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(300),
    "seasonId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "resourceId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE INDEX "user_permissions_permission_idx" ON "user_permissions"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_code_key" ON "seasons"("code");

-- CreateIndex
CREATE INDEX "seasons_isActive_idx" ON "seasons"("isActive");

-- CreateIndex
CREATE INDEX "seasons_isClosed_startDate_idx" ON "seasons"("isClosed", "startDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "season_counters_seasonId_prefix_key" ON "season_counters"("seasonId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "global_counters_name_key" ON "global_counters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_isActive_type_idx" ON "customers"("isActive", "type");

-- CreateIndex
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "suppliers_deletedAt_idx" ON "suppliers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_name_idx" ON "items"("name");

-- CreateIndex
CREATE INDEX "items_category_isActive_idx" ON "items"("category", "isActive");

-- CreateIndex
CREATE INDEX "items_isActive_code_idx" ON "items"("isActive", "code");

-- CreateIndex
CREATE INDEX "items_deletedAt_idx" ON "items"("deletedAt");

-- CreateIndex
CREATE INDEX "item_stocks_itemId_warehouse_idx" ON "item_stocks"("itemId", "warehouse");

-- CreateIndex
CREATE INDEX "item_stocks_warehouse_quantity_idx" ON "item_stocks"("warehouse", "quantity");

-- CreateIndex
CREATE INDEX "item_stocks_seasonId_warehouse_idx" ON "item_stocks"("seasonId", "warehouse");

-- CreateIndex
CREATE UNIQUE INDEX "item_stocks_itemId_warehouse_seasonId_key" ON "item_stocks"("itemId", "warehouse", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "workers_code_key" ON "workers"("code");

-- CreateIndex
CREATE INDEX "workers_scope_isActive_idx" ON "workers"("scope", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sale_invoices_invoiceNumber_key" ON "sale_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "sale_invoices_customerId_status_idx" ON "sale_invoices"("customerId", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_customerId_seasonId_status_idx" ON "sale_invoices"("customerId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_customerId_paymentMethod_status_idx" ON "sale_invoices"("customerId", "paymentMethod", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_seasonId_status_idx" ON "sale_invoices"("seasonId", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_seasonId_date_idx" ON "sale_invoices"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "sale_invoices_seasonId_createdAt_idx" ON "sale_invoices"("seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "sale_invoices_warehouse_seasonId_status_idx" ON "sale_invoices"("warehouse", "seasonId", "status");

-- CreateIndex
CREATE INDEX "sale_invoices_status_date_idx" ON "sale_invoices"("status", "date" DESC);

-- CreateIndex
CREATE INDEX "sale_invoices_date_idx" ON "sale_invoices"("date" DESC);

-- CreateIndex
CREATE INDEX "sale_invoices_deletedAt_idx" ON "sale_invoices"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sale_invoices_docNumber_seasonId_key" ON "sale_invoices"("docNumber", "seasonId");

-- CreateIndex
CREATE INDEX "sale_invoice_items_invoiceId_idx" ON "sale_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "sale_invoice_items_itemId_idx" ON "sale_invoice_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_invoiceNumber_key" ON "purchase_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_status_idx" ON "purchase_invoices"("supplierId", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_seasonId_idx" ON "purchase_invoices"("supplierId", "seasonId");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_seasonId_status_idx" ON "purchase_invoices"("supplierId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_seasonId_status_idx" ON "purchase_invoices"("seasonId", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_seasonId_date_idx" ON "purchase_invoices"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "purchase_invoices_seasonId_createdAt_idx" ON "purchase_invoices"("seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "purchase_invoices_warehouse_seasonId_status_idx" ON "purchase_invoices"("warehouse", "seasonId", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_status_date_idx" ON "purchase_invoices"("status", "date" DESC);

-- CreateIndex
CREATE INDEX "purchase_invoices_date_idx" ON "purchase_invoices"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_docNumber_seasonId_key" ON "purchase_invoices"("docNumber", "seasonId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_invoiceId_idx" ON "purchase_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_itemId_idx" ON "purchase_invoice_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "return_invoices_invoiceNumber_key" ON "return_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "return_invoices_customerId_type_status_idx" ON "return_invoices"("customerId", "type", "status");

-- CreateIndex
CREATE INDEX "return_invoices_customerId_type_seasonId_idx" ON "return_invoices"("customerId", "type", "seasonId");

-- CreateIndex
CREATE INDEX "return_invoices_supplierId_type_status_idx" ON "return_invoices"("supplierId", "type", "status");

-- CreateIndex
CREATE INDEX "return_invoices_supplierId_type_seasonId_idx" ON "return_invoices"("supplierId", "type", "seasonId");

-- CreateIndex
CREATE INDEX "return_invoices_seasonId_type_status_idx" ON "return_invoices"("seasonId", "type", "status");

-- CreateIndex
CREATE INDEX "return_invoices_seasonId_createdAt_idx" ON "return_invoices"("seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "return_invoices_date_idx" ON "return_invoices"("date" DESC);

-- CreateIndex
CREATE INDEX "return_invoice_items_invoiceId_idx" ON "return_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "return_invoice_items_itemId_idx" ON "return_invoice_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "payments_customerId_type_idx" ON "payments"("customerId", "type");

-- CreateIndex
CREATE INDEX "payments_supplierId_type_idx" ON "payments"("supplierId", "type");

-- CreateIndex
CREATE INDEX "payments_customerId_type_seasonId_idx" ON "payments"("customerId", "type", "seasonId");

-- CreateIndex
CREATE INDEX "payments_supplierId_type_seasonId_idx" ON "payments"("supplierId", "type", "seasonId");

-- CreateIndex
CREATE INDEX "payments_seasonId_date_idx" ON "payments"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "payments_seasonId_createdAt_idx" ON "payments"("seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payments_date_idx" ON "payments"("date" DESC);

-- CreateIndex
CREATE INDEX "payments_deletedAt_idx" ON "payments"("deletedAt");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_warehouse_date_idx" ON "stock_movements"("itemId", "warehouse", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_itemId_seasonId_date_idx" ON "stock_movements"("itemId", "seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_itemId_warehouse_seasonId_idx" ON "stock_movements"("itemId", "warehouse", "seasonId");

-- CreateIndex
CREATE INDEX "stock_movements_seasonId_date_idx" ON "stock_movements"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_referenceId_referenceModel_idx" ON "stock_movements"("referenceId", "referenceModel");

-- CreateIndex
CREATE INDEX "stock_movements_type_date_idx" ON "stock_movements"("type", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_date_idx" ON "stock_movements"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_refNumber_key" ON "stock_adjustments"("refNumber");

-- CreateIndex
CREATE INDEX "stock_adjustments_seasonId_date_idx" ON "stock_adjustments"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_adjustments_warehouse_date_idx" ON "stock_adjustments"("warehouse", "date" DESC);

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_adjustmentId_idx" ON "stock_adjustment_lines"("adjustmentId");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_itemId_idx" ON "stock_adjustment_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_transferNumber_key" ON "transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "transfers_seasonId_status_idx" ON "transfers"("seasonId", "status");

-- CreateIndex
CREATE INDEX "transfers_seasonId_date_idx" ON "transfers"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "transfers_direction_status_idx" ON "transfers"("direction", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_docNumber_direction_seasonId_key" ON "transfers"("docNumber", "direction", "seasonId");

-- CreateIndex
CREATE INDEX "transfer_items_transferId_idx" ON "transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "transfer_items_itemId_idx" ON "transfer_items"("itemId");

-- CreateIndex
CREATE INDEX "manufacturing_orders_seasonId_status_createdAt_idx" ON "manufacturing_orders"("seasonId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "manufacturing_orders_seasonId_warehouse_date_idx" ON "manufacturing_orders"("seasonId", "warehouse", "date" DESC);

-- CreateIndex
CREATE INDEX "manufacturing_orders_workerId_seasonId_date_idx" ON "manufacturing_orders"("workerId", "seasonId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_orders_seasonId_orderNumber_key" ON "manufacturing_orders"("seasonId", "orderNumber");

-- CreateIndex
CREATE INDEX "manufacturing_raw_materials_orderId_idx" ON "manufacturing_raw_materials"("orderId");

-- CreateIndex
CREATE INDEX "manufacturing_raw_materials_itemId_idx" ON "manufacturing_raw_materials"("itemId");

-- CreateIndex
CREATE INDEX "manufacturing_outputs_orderId_idx" ON "manufacturing_outputs"("orderId");

-- CreateIndex
CREATE INDEX "manufacturing_outputs_itemId_idx" ON "manufacturing_outputs"("itemId");

-- CreateIndex
CREATE INDEX "treasury_entries_treasury_date_idx" ON "treasury_entries"("treasury", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_treasury_type_date_idx" ON "treasury_entries"("treasury", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_treasury_seasonId_date_idx" ON "treasury_entries"("treasury", "seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_referenceId_referenceModel_idx" ON "treasury_entries"("referenceId", "referenceModel");

-- CreateIndex
CREATE INDEX "treasury_entries_customerId_date_idx" ON "treasury_entries"("customerId", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_supplierId_date_idx" ON "treasury_entries"("supplierId", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_seasonId_date_idx" ON "treasury_entries"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "treasury_entries_date_idx" ON "treasury_entries"("date" DESC);

-- CreateIndex
CREATE INDEX "cash_registers_userId_date_idx" ON "cash_registers"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "cash_registers_userId_seasonId_date_idx" ON "cash_registers"("userId", "seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "cash_registers_seasonId_date_idx" ON "cash_registers"("seasonId", "date" DESC);

-- CreateIndex
CREATE INDEX "cash_registers_date_idx" ON "cash_registers"("date" DESC);

-- CreateIndex
CREATE INDEX "price_lists_priceListName_isActive_idx" ON "price_lists"("priceListName", "isActive");

-- CreateIndex
CREATE INDEX "price_lists_isActive_idx" ON "price_lists"("isActive");

-- CreateIndex
CREATE INDEX "price_list_item_links_priceListId_idx" ON "price_list_item_links"("priceListId");

-- CreateIndex
CREATE INDEX "price_list_item_links_itemId_idx" ON "price_list_item_links"("itemId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_seasonId_createdAt_idx" ON "audit_logs"("seasonId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_counters" ADD CONSTRAINT "season_counters_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_items" ADD CONSTRAINT "sale_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sale_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_items" ADD CONSTRAINT "sale_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoices" ADD CONSTRAINT "return_invoices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoices" ADD CONSTRAINT "return_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoices" ADD CONSTRAINT "return_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoices" ADD CONSTRAINT "return_invoices_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoices" ADD CONSTRAINT "return_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoice_items" ADD CONSTRAINT "return_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "return_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_invoice_items" ADD CONSTRAINT "return_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_raw_materials" ADD CONSTRAINT "manufacturing_raw_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_raw_materials" ADD CONSTRAINT "manufacturing_raw_materials_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_outputs" ADD CONSTRAINT "manufacturing_outputs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_outputs" ADD CONSTRAINT "manufacturing_outputs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_entries" ADD CONSTRAINT "treasury_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_entries" ADD CONSTRAINT "treasury_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_entries" ADD CONSTRAINT "treasury_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_entries" ADD CONSTRAINT "treasury_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_item_links" ADD CONSTRAINT "price_list_item_links_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_item_links" ADD CONSTRAINT "price_list_item_links_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
