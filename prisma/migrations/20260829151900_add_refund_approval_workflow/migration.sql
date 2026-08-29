-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundDeniedAt" TIMESTAMP(3),
ADD COLUMN     "refundDeniedBy" TEXT,
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN     "refundRequestedBy" TEXT,
ADD COLUMN     "refundStatus" TEXT;
