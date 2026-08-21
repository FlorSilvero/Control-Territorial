import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseBackupFile, listBackups } from "@/lib/backup"

const COLLECTIONS = [
  "organizations",
  "users",
  "accounts",
  "sessions",
  "verificationTokens",
  "districts",
  "pastors",
  "churches",
  "pastorAssignments",
  "statisticRecords",
  "auditLogs",
]

function validBackup(overrides: Record<string, unknown> = {}) {
  return {
    meta: { createdAt: "2026-08-20T23:14:22.342Z", counts: { districts: 3 } },
    data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// parseBackupFile is the gate in front of a full-database wipe: anything it
// lets through gets restored, so every rejection path matters.
// ---------------------------------------------------------------------------
describe("parseBackupFile", () => {
  it("accepts a backup produced by createBackup", () => {
    const parsed = parseBackupFile(JSON.stringify(validBackup()))
    expect(parsed.meta.createdAt).toBe("2026-08-20T23:14:22.342Z")
    expect(parsed.data.districts).toEqual([])
  })

  it("rejects malformed JSON", () => {
    expect(() => parseBackupFile("{not json")).toThrow(/JSON válido/)
  })

  it("rejects JSON that isn't shaped like a backup", () => {
    expect(() => parseBackupFile('{"hello":"world"}')).toThrow(/formato de un backup/)
    expect(() => parseBackupFile("[]")).toThrow(/formato de un backup/)
    expect(() => parseBackupFile("null")).toThrow(/formato de un backup/)
  })

  it("rejects a backup missing any collection", () => {
    const backup = validBackup()
    delete (backup.data as Record<string, unknown>).statisticRecords
    expect(() => parseBackupFile(JSON.stringify(backup))).toThrow(/statisticRecords/)
  })

  it("rejects a collection that isn't an array", () => {
    const backup = validBackup()
    ;(backup.data as Record<string, unknown>).churches = { nope: true }
    expect(() => parseBackupFile(JSON.stringify(backup))).toThrow(/churches/)
  })
})

describe("listBackups", () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-test-"))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("returns an empty list when the directory doesn't exist", () => {
    expect(listBackups(path.join(dir, "missing"))).toEqual([])
  })

  it("lists valid backups newest first", () => {
    const older = validBackup({ meta: { createdAt: "2026-01-01T00:00:00.000Z", counts: {} } })
    const newer = validBackup({ meta: { createdAt: "2026-08-01T00:00:00.000Z", counts: {} } })
    fs.writeFileSync(path.join(dir, "backup-a.json"), JSON.stringify(older))
    fs.writeFileSync(path.join(dir, "backup-b.json"), JSON.stringify(newer))

    const list = listBackups(dir)
    expect(list.map((b) => b.name)).toEqual(["backup-b.json", "backup-a.json"])
    expect(list[0].sizeBytes).toBeGreaterThan(0)
  })

  it("skips corrupt files and unrelated ones instead of failing", () => {
    fs.writeFileSync(path.join(dir, "backup-good.json"), JSON.stringify(validBackup()))
    fs.writeFileSync(path.join(dir, "backup-corrupt.json"), "{ broken")
    fs.writeFileSync(path.join(dir, "notes.txt"), "hello")

    expect(listBackups(dir).map((b) => b.name)).toEqual(["backup-good.json"])
  })
})
