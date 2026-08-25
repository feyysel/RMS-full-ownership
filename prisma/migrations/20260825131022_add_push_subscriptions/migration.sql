-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_restaurantId_idx" ON "PushSubscription"("restaurantId");

-- CreateIndex
CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "BellCall_tableId_status_createdAt_idx" ON "BellCall"("tableId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_scope_createdAt_idx" ON "EventLog"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_createdAt_idx" ON "MenuItem"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_restaurantId_role_read_idx" ON "Notification"("restaurantId", "role", "read");

-- CreateIndex
CREATE INDEX "Order_restaurantId_waiterId_status_idx" ON "Order"("restaurantId", "waiterId", "status");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_name_idx" ON "OrderItem"("name");

-- CreateIndex
CREATE INDEX "Receipt_restaurantId_generatedAt_idx" ON "Receipt"("restaurantId", "generatedAt");

-- CreateIndex
CREATE INDEX "Table_restaurantId_status_idx" ON "Table"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Table_restaurantId_waiterId_idx" ON "Table"("restaurantId", "waiterId");

-- CreateIndex
CREATE INDEX "User_restaurantId_role_idx" ON "User"("restaurantId", "role");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
