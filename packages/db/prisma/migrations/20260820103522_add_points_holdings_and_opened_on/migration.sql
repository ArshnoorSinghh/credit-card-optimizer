-- AlterTable
ALTER TABLE "saved_cards" ADD COLUMN     "opened_on" DATE;

-- CreateTable
CREATE TABLE "points_holdings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "expiry_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "points_holdings_user_id_idx" ON "points_holdings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_holdings_user_id_currency_key" ON "points_holdings"("user_id", "currency");

-- AddForeignKey
ALTER TABLE "points_holdings" ADD CONSTRAINT "points_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
