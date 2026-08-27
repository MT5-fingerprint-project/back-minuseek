-- CreateTable
CREATE TABLE "ServiceSettings" (
    "id" TEXT NOT NULL,
    "administration" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "postalAddress" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "signatureCity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSettings_pkey" PRIMARY KEY ("id")
);
