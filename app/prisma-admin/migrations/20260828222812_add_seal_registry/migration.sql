-- CreateEnum
CREATE TYPE "SealKind" AS ENUM ('TRACE', 'REFERENCE_PRINT', 'REPORT');

-- CreateTable
CREATE TABLE "seal_registry" (
    "id" UUID NOT NULL,
    "tenant_slug" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "kind" "SealKind" NOT NULL,
    "chain_seq" BIGINT NOT NULL,
    "sealed_at" TIMESTAMP(3) NOT NULL,
    "anchored_at" TIMESTAMP(3),
    "case_id" UUID,
    "report_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seal_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seal_registry_tenant_slug_case_id_idx" ON "seal_registry"("tenant_slug", "case_id");

-- CreateIndex
CREATE UNIQUE INDEX "seal_registry_tenant_slug_sha256_key" ON "seal_registry"("tenant_slug", "sha256");

-- AddForeignKey
ALTER TABLE "seal_registry" ADD CONSTRAINT "seal_registry_tenant_slug_fkey" FOREIGN KEY ("tenant_slug") REFERENCES "tenant"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
