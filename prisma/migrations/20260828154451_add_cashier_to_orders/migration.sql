-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashierId" TEXT;

-- CreateIndex
CREATE INDEX "Order_cashierId_status_createdAt_idx" ON "Order"("cashierId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
