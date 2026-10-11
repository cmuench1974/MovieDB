-- SSO-Konten brauchen kein lokales Passwort; Authentik-Sub ist optional und eindeutig.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "authentikSub" TEXT;
CREATE UNIQUE INDEX "User_authentikSub_key" ON "User"("authentikSub");
