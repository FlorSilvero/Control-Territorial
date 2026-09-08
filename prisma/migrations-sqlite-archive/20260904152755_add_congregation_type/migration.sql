-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Church" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IGLESIA',
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "organizationId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "Church_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Church_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Church" ("address", "archivedAt", "createdAt", "createdById", "districtId", "id", "name", "notes", "organizationId", "updatedAt", "updatedById") SELECT "address", "archivedAt", "createdAt", "createdById", "districtId", "id", "name", "notes", "organizationId", "updatedAt", "updatedById" FROM "Church";
DROP TABLE "Church";
ALTER TABLE "new_Church" RENAME TO "Church";
CREATE INDEX "Church_organizationId_idx" ON "Church"("organizationId");
CREATE INDEX "Church_districtId_idx" ON "Church"("districtId");
CREATE INDEX "Church_archivedAt_idx" ON "Church"("archivedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
