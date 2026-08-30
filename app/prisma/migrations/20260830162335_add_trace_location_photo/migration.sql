-- CreateTable
CREATE TABLE "TraceLocationPhoto" (
    "id" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraceLocationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TraceLocationPhoto_traceId_key" ON "TraceLocationPhoto"("traceId");

-- AddForeignKey
ALTER TABLE "TraceLocationPhoto" ADD CONSTRAINT "TraceLocationPhoto_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
