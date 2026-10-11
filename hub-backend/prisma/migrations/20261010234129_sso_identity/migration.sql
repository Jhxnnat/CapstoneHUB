-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'microsoft');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "auth_provider" "AuthProvider" NOT NULL DEFAULT 'local',
ADD COLUMN     "entra_object_id" VARCHAR(255),
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uk_user_entra_object_id" ON "user"("entra_object_id");

