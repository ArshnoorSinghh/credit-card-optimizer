-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('cashback', 'points', 'miles');

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "elig_min_monthly_salary_aed" INTEGER NOT NULL,
    "elig_uae_resident_required" BOOLEAN NOT NULL,
    "elig_min_age" INTEGER NOT NULL,
    "elig_salary_transfer_required" BOOLEAN NOT NULL,
    "elig_employer_restrictions" JSONB,
    "fees_annual_fee_aed" DOUBLE PRECISION NOT NULL,
    "fees_waiver_conditions" TEXT,
    "fees_joining_fee_aed" DOUBLE PRECISION NOT NULL,
    "rewards_type" "RewardType" NOT NULL,
    "rewards_currency" TEXT NOT NULL,
    "rewards_base_rate" TEXT NOT NULL,
    "rewards_overall_cap" DOUBLE PRECISION,
    "rewards_min_monthly_spend_required_aed" DOUBLE PRECISION NOT NULL,
    "redemption" JSONB NOT NULL,
    "benefits" JSONB NOT NULL,
    "source_url" TEXT NOT NULL,
    "notes" TEXT,
    "excluded_from_scoring" BOOLEAN,
    "data_caveat" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_categories" (
    "id" SERIAL NOT NULL,
    "card_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "monthly_cap" DOUBLE PRECISION,
    "annual_cap" DOUBLE PRECISION,

    CONSTRAINT "reward_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_bank_idx" ON "cards"("bank");

-- CreateIndex
CREATE INDEX "cards_elig_min_monthly_salary_aed_idx" ON "cards"("elig_min_monthly_salary_aed");

-- CreateIndex
CREATE INDEX "cards_rewards_currency_idx" ON "cards"("rewards_currency");

-- CreateIndex
CREATE INDEX "reward_categories_card_id_idx" ON "reward_categories"("card_id");

-- CreateIndex
CREATE INDEX "reward_categories_category_idx" ON "reward_categories"("category");

-- CreateIndex
CREATE UNIQUE INDEX "reward_categories_card_id_position_key" ON "reward_categories"("card_id", "position");

-- AddForeignKey
ALTER TABLE "reward_categories" ADD CONSTRAINT "reward_categories_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
