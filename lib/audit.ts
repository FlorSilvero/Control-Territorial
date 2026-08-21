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
