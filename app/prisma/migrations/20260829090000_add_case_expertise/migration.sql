-- CreateTable
CREATE TABLE "CaseExpertise" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "expertUserId" UUID NOT NULL,
    "oathStatement" TEXT NOT NULL,
    "courtReference" TEXT NOT NULL,
    "swornAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseExpertise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseExpertise_caseId_key" ON "CaseExpertise"("caseId");
