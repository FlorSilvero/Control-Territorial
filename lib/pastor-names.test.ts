import { describe, it, expect } from "vitest"
import { rosterPastorName, pastorNameKey, splitRosterPastorName } from "@/lib/pastor-names"

// ---------------------------------------------------------------------------
// The roster planilla writes a pastor as one cell but the app stores the name
// in two columns, so these three functions are the whole round-trip: export
// joins, the key matches an existing record regardless of word order, and the
// split only runs for a pastor that has to be created.
// ---------------------------------------------------------------------------

describe("rosterPastorName", () => {
  it("writes surname first, the way the planilla reads", () => {
    expect(rosterPastorName("Nestor Gabriel", "Cerdá Pissano")).toBe("Cerdá Pissano Nestor Gabriel")
  })
})

describe("pastorNameKey", () => {
  it("ignores word order, so an exported name matches the pastor it came from", () => {
    expect(pastorNameKey("Cerdá Pissano Nestor Gabriel")).toBe(
      pastorNameKey("Nestor Gabriel Cerdá Pissano"),
    )
  })

  it("ignores accents, casing and the comma form", () => {
    expect(pastorNameKey("MARTÍNEZ, Lucas Esteban")).toBe(pastorNameKey("lucas esteban martinez"))
  })

  it("collapses repeated whitespace", () => {
    expect(pastorNameKey("  Lee   Wonki ")).toBe(pastorNameKey("Wonki Lee"))
  })

  it("keeps different people apart", () => {
    expect(pastorNameKey("Silva Claudio Federico")).not.toBe(pastorNameKey("Silva Claudio Fernando"))
  })
})

describe("splitRosterPastorName", () => {
  it("treats a comma as authoritative", () => {
    expect(splitRosterPastorName("Rivero Dupleich, Moisés Elías")).toEqual({
      lastName: "Rivero Dupleich",
      firstName: "Moisés Elías",
    })
  })

  it("takes one surname from a two-word name", () => {
    expect(splitRosterPastorName("Lee Wonki")).toEqual({ lastName: "Lee", firstName: "Wonki" })
  })

  it("takes one surname from a three-word name", () => {
    expect(splitRosterPastorName("Salinas Matias Diego")).toEqual({
      lastName: "Salinas",
      firstName: "Matias Diego",
    })
  })

  it("takes two surnames from a four-word name", () => {
    expect(splitRosterPastorName("Cerdá Pissano Nestor Gabriel")).toEqual({
      lastName: "Cerdá Pissano",
      firstName: "Nestor Gabriel",
    })
  })

  it("rejects a name it cannot split instead of guessing", () => {
    expect(splitRosterPastorName("Lee")).toBeNull()
    expect(splitRosterPastorName("")).toBeNull()
    expect(splitRosterPastorName("Rivero Dupleich,")).toBeNull()
    expect(splitRosterPastorName(", Moisés")).toBeNull()
  })

  it("round-trips a name the export wrote", () => {
    const written = rosterPastorName("Nestor Gabriel", "Cerdá Pissano")
    expect(splitRosterPastorName(written)).toEqual({
      lastName: "Cerdá Pissano",
      firstName: "Nestor Gabriel",
    })
  })
})
