-- CreateEnum
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'CBE', 'TELEBIRR', 'ABYSSINIA', 'POS');

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING (
  CASE WHEN "paymentMethod" IN ('CARD', 'CARD_ONLINE', 'OTHER') THEN 'POS'::"PaymentMethod_new" ELSE "paymentMethod"::text::"PaymentMethod_new" END
);

ALTER TABLE "Receipt" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING (
  CASE WHEN "paymentMethod" IN ('CARD', 'CARD_ONLINE', 'OTHER') THEN 'POS'::"PaymentMethod_new" ELSE "paymentMethod"::text::"PaymentMethod_new" END
);

-- DropEnum
DROP TYPE "PaymentMethod";

-- RenameEnum
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";