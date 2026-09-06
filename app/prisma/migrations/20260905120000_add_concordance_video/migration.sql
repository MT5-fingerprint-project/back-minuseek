-- CreateTable
CREATE TABLE "ConcordanceVideo" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "referencePrintId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcordanceVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConcordanceVideo_traceId_referencePrintId_idx" ON "ConcordanceVideo"("traceId", "referencePrintId");
