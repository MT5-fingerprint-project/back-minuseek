-- CreateEnum
CREATE TYPE "EvidenceClass" AS ENUM ('OBSERVED', 'DECLARED');

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "seq" BIGINT NOT NULL,
    "eventType" TEXT NOT NULL,
    "evidenceClass" "EvidenceClass" NOT NULL,
    "actor" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "caseId" UUID,
    "traceId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "prevHash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAnchor" (
    "id" UUID NOT NULL,
    "headSeq" BIGINT NOT NULL,
    "headHash" CHAR(64) NOT NULL,
    "tsaUrl" TEXT NOT NULL,
    "tsaResponse" BYTEA NOT NULL,
    "anchoredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "AuditAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_seq_key" ON "AuditEvent"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_hash_key" ON "AuditEvent"("hash");

-- CreateIndex
CREATE INDEX "AuditEvent_caseId_idx" ON "AuditEvent"("caseId");

-- CreateIndex
CREATE INDEX "AuditEvent_traceId_idx" ON "AuditEvent"("traceId");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");
