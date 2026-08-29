-- CreateIndex
CREATE INDEX "EventLog_scope_scopeId_type_createdAt_idx" ON "EventLog"("scope", "scopeId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Order_restaurantId_refundStatus_idx" ON "Order"("restaurantId", "refundStatus");
