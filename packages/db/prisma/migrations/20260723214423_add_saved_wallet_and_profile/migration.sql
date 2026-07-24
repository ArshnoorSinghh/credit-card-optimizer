-- AlterTable
ALTER TABLE "users" ADD COLUMN     "saved_bank" TEXT,
ADD COLUMN     "saved_salary_aed" INTEGER,
ADD COLUMN     "saved_spending" JSONB;

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_cards_user_id_idx" ON "saved_cards"("user_id");

-- CreateIndex
CREATE INDEX "saved_cards_card_id_idx" ON "saved_cards"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_user_id_card_id_key" ON "saved_cards"("user_id", "card_id");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
