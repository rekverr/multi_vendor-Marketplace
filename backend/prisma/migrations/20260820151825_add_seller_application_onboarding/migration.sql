-- DropIndex
DROP INDEX "SellerApplication_userId_key";

-- AlterTable
ALTER TABLE "SellerApplication" ADD COLUMN "displayName" TEXT;

UPDATE "SellerApplication" AS application
SET "displayName" = COALESCE(profile."displayName", split_part(account."email", '@', 1))
FROM "User" AS account
LEFT JOIN "SellerProfile" AS profile ON profile."userId" = account."id"
WHERE application."userId" = account."id";

ALTER TABLE "SellerApplication" ALTER COLUMN "displayName" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SellerApplication_userId_status_idx" ON "SellerApplication"("userId", "status");

CREATE UNIQUE INDEX "SellerApplication_one_pending_per_user_key"
ON "SellerApplication"("userId")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "SellerApplication_one_approved_per_user_key"
ON "SellerApplication"("userId")
WHERE "status" = 'APPROVED';
