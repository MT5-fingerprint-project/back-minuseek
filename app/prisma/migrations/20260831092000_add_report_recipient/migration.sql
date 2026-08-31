-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN     "recipientAttentionName" TEXT,
ADD COLUMN     "recipientAttentionQuality" TEXT,
ADD COLUMN     "recipientAuthority" TEXT;

-- CreateTable
CREATE TABLE "RecipientBookEntry" (
    "id" UUID NOT NULL,
    "authority" TEXT NOT NULL,
    "attentionQuality" TEXT,
    "attentionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipientBookEntry_pkey" PRIMARY KEY ("id")
);
