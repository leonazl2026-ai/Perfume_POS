-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contactLink" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WALK_IN',
    "tier" TEXT NOT NULL DEFAULT 'NEW',
    "tierLocked" BOOLEAN NOT NULL DEFAULT false,
    "preferences" TEXT,
    "notes" TEXT,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL NOT NULL DEFAULT 0,
    "lastPurchaseAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WastageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productVariantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bottlesDeducted" INTEGER NOT NULL DEFAULT 0,
    "mlDeducted" REAL NOT NULL DEFAULT 0,
    "costPerMl" DECIMAL NOT NULL,
    "bottleCost" DECIMAL NOT NULL,
    "lossValue" DECIMAL NOT NULL,
    "note" TEXT,
    "expenseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WastageLog_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WastageLog_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "categoryId", "createdAt", "description", "expenseDate", "id") SELECT "amount", "categoryId", "createdAt", "description", "expenseDate", "id" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE TABLE "new_ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantBatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fullBottleSizeMl" REAL NOT NULL,
    "bottleCost" DECIMAL NOT NULL,
    "vialCost" DECIMAL NOT NULL DEFAULT 0,
    "costPerMl" DECIMAL NOT NULL,
    "fullBottleSellingPrice" DECIMAL NOT NULL,
    "unopenedBottles" INTEGER NOT NULL DEFAULT 0,
    "decantActiveRemainingMl" REAL NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "purchaseDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supplierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductVariant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductVariant" ("batchNumber", "bottleCost", "costPerMl", "createdAt", "decantActiveRemainingMl", "fullBottleSellingPrice", "fullBottleSizeMl", "id", "isActive", "notes", "productId", "purchaseDate", "unopenedBottles", "updatedAt", "variantBatchId", "vialCost") SELECT "batchNumber", "bottleCost", "costPerMl", "createdAt", "decantActiveRemainingMl", "fullBottleSellingPrice", "fullBottleSizeMl", "id", "isActive", "notes", "productId", "purchaseDate", "unopenedBottles", "updatedAt", "variantBatchId", "vialCost" FROM "ProductVariant";
DROP TABLE "ProductVariant";
ALTER TABLE "new_ProductVariant" RENAME TO "ProductVariant";
CREATE UNIQUE INDEX "ProductVariant_variantBatchId_key" ON "ProductVariant"("variantBatchId");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_supplierId_idx" ON "ProductVariant"("supplierId");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleNumber" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "customerId" TEXT,
    "orderChannel" TEXT NOT NULL DEFAULT 'WALK_IN',
    "subtotal" DECIMAL NOT NULL,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "totalCost" DECIMAL NOT NULL,
    "totalProfit" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "courier" TEXT,
    "trackingNumber" TEXT,
    "deliveryAddress" TEXT,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("courier", "createdAt", "customerName", "customerPhone", "deliveredAt", "deliveryAddress", "deliveryStatus", "discount", "id", "notes", "paymentMethod", "saleDate", "saleNumber", "shippedAt", "status", "subtotal", "tax", "total", "totalCost", "totalProfit", "trackingNumber") SELECT "courier", "createdAt", "customerName", "customerPhone", "deliveredAt", "deliveryAddress", "deliveryStatus", "discount", "id", "notes", "paymentMethod", "saleDate", "saleNumber", "shippedAt", "status", "subtotal", "tax", "total", "totalCost", "totalProfit", "trackingNumber" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");
CREATE INDEX "Sale_saleDate_idx" ON "Sale"("saleDate");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_deliveryStatus_idx" ON "Sale"("deliveryStatus");
CREATE INDEX "Sale_customerName_idx" ON "Sale"("customerName");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_orderChannel_idx" ON "Sale"("orderChannel");
CREATE INDEX "Sale_paymentMethod_idx" ON "Sale"("paymentMethod");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_tier_idx" ON "Customer"("tier");

-- CreateIndex
CREATE INDEX "Customer_channel_idx" ON "Customer"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "WastageLog_expenseId_key" ON "WastageLog"("expenseId");

-- CreateIndex
CREATE INDEX "WastageLog_productVariantId_idx" ON "WastageLog"("productVariantId");

-- CreateIndex
CREATE INDEX "WastageLog_createdAt_idx" ON "WastageLog"("createdAt");

-- CreateIndex
CREATE INDEX "WastageLog_reason_idx" ON "WastageLog"("reason");
