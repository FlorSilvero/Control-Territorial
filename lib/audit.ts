import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"

/**
 * Single writer for the AuditLog table, shared by every server action.
 *
 * `metadata` is typed as Prisma.InputJsonValue rather than the looser
 * Record<string, unknown> the per-file copies of this helper used: a Json
 * column only accepts JSON-serializable values, and the looser type let
 * non-serializable ones (Date, undefined, class instances) through to a
 * runtime failure instead of a compile error.
 */
export async function audit(
  orgId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    },
  })
}

export type AuditEntry = {
  action: string
  entityType: string
  entityId: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Bulk variant of `audit` for importers, which would otherwise pay one round
 * trip per imported row. `client` accepts a transaction client so the log is
 * written in the same transaction as the rows it describes.
 */
export async function auditMany(
  client: Pick<Prisma.TransactionClient, "auditLog">,
  orgId: string,
  actorId: string,
  entries: AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return
  await client.auditLog.createMany({
    data: entries.map((e) => ({ ...e, organizationId: orgId, actorId })),
  })
}
