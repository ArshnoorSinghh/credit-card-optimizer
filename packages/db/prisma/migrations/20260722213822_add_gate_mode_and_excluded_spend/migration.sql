-- CreateEnum
CREATE TYPE "GateMode" AS ENUM ('degrade', 'forfeit');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "rewards_gate_mode" "GateMode";

-- CreateTable
CREATE TABLE "excluded_spend" (
    "id" SERIAL NOT NULL,
    "card_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "excluded_spend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excluded_spend_card_id_idx" ON "excluded_spend"("card_id");

-- CreateIndex
CREATE INDEX "excluded_spend_category_idx" ON "excluded_spend"("category");

-- CreateIndex
CREATE UNIQUE INDEX "excluded_spend_card_id_position_key" ON "excluded_spend"("card_id", "position");

-- AddForeignKey
ALTER TABLE "excluded_spend" ADD CONSTRAINT "excluded_spend_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
