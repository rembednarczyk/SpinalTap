import { describe, expect, it } from "vitest";
import { DISTRICTS, ENCOUNTERS, WORLD_CHUNKS, distanceToRect } from "../src/content";

/** Clearance a walking character needs around the trigger point. */
const BODY = 0.5;

const solidsAt = (x: number, z: number) =>
  WORLD_CHUNKS.flatMap((c) => c.props).filter((p) => {
    if (!p.solid || p.view.kind !== "block") return false;
    const { size } = p.view;
    const bottom = p.center.y - size.y / 2;
    const top = p.center.y + size.y / 2;
    // Only what stands where a person walks on the ground (not floors, roofs or high slabs).
    if (top < 0.3 || bottom > 1.8) return false;
    return Math.abs(x - p.center.x) < size.x / 2 + BODY && Math.abs(z - p.center.z) < size.z / 2 + BODY;
  });

describe("street encounters (ADR-0032)", () => {
  it("have unique ids and knots named after their district", () => {
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(ENCOUNTERS.length);
    const prefix: Readonly<Record<string, string>> = { "shinsekai-7": "enc_s7_", kanal: "enc_kanal_", targ: "enc_targ_", doki: "enc_doki_" };
    for (const e of ENCOUNTERS) expect(e.knot.startsWith(prefix[e.district] ?? "?"), e.id).toBe(true);
  });

  it("give every district three to five", () => {
    for (const district of Object.keys(DISTRICTS)) {
      const n = ENCOUNTERS.filter((e) => e.district === district).length;
      expect(n, district).toBeGreaterThanOrEqual(3);
      expect(n, district).toBeLessThanOrEqual(5);
    }
  });

  it.each(ENCOUNTERS.map((e) => [e.id, e] as const))("%s: valid hours and radius, on open ground in its own district", (_id, e) => {
    for (const h of [e.fromHour, e.toHour]) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(24);
    }
    expect(e.fromHour).not.toBe(e.toHour);
    expect(e.radius).toBeGreaterThan(1);
    expect(e.radius).toBeLessThanOrEqual(8);
    const chunks = WORLD_CHUNKS.filter((c) => distanceToRect(e.at.x, e.at.z, c.bounds) === 0);
    expect(chunks.some((c) => c.district === e.district)).toBe(true);
    expect(solidsAt(e.at.x, e.at.z).map((p) => p.center)).toEqual([]);
  });
});
