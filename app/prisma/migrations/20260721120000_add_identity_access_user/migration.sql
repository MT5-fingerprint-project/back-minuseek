-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'EXPERT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "identityProviderId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "grade" TEXT NOT NULL,
    "serviceNumber" TEXT NOT NULL,
    "personalDataId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalData" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identityProviderId_key" ON "User"("identityProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_serviceNumber_key" ON "User"("serviceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_personalDataId_key" ON "User"("personalDataId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personalDataId_fkey" FOREIGN KEY ("personalDataId") REFERENCES "PersonalData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
