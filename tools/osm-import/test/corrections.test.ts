import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STOREY } from "../src/building-tags.ts";
import { partTier } from "../src/building-parts.ts";
import { TAG_CORRECTIONS, corrected, correctedLine } from "../src/corrections.ts";
import { type Area, type Line } from "../src/features.ts";

/** The explicit corrections of estimated OSM tags: documented, and applied to the right element only. */

const annex: Area = { id: "w617597406", osmId: 617597406, tags: { "building:levels": "2", "building:part": "yes", "roof:colour": "brown" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };

describe("tag corrections (ADR-0042)", () => {
  it("names each correction's reason and its entry in the topography register", () => {
    expect(TAG_CORRECTIONS.length).toBeGreaterThan(0);
    for (const c of TAG_CORRECTIONS) {
      expect(c.id).toMatch(/^[wr]\d+$/);
      expect(c.reason.length).toBeGreaterThan(10);
      expect(c.ref).toMatch(/^T-\d{3}$/);
      expect(Object.keys(c.tags).length > 0 || c.scale !== undefined).toBe(true);
    }
    expect(new Set(TAG_CORRECTIONS.map((c) => c.id)).size).toBe(TAG_CORRECTIONS.length);
  });

  it("raises Brama Krakowska's annex from two estimated storeys to the measured 9.3 m over its base (T-033)", () => {
    expect(partTier(annex, "historic")!.eaves).toBeCloseTo(2 * STOREY, 6);
    const tier = partTier(corrected(annex), "historic")!;
    expect(tier.eaves).toBeCloseTo(9.3, 6);
    expect(tier.source).toBe("height");
    // Other elements and the other tags stay as mapped.
    expect(corrected({ ...annex, id: "w617597407" }).tags).toEqual(annex.tags);
    expect(corrected(annex).tags["roof:colour"]).toBe("brown");
  });

  it("corrects a line's tags by its id and leaves other lines and tags as mapped (G-203)", () => {
    const run: Line = { id: "w1305889408", osmId: 1305889408, tags: { highway: "steps", step_count: "40" }, line: [{ x: 784.7, z: 243.4 }, { x: 800.3, z: 242.5 }] };
    expect(correctedLine(run).tags).toEqual({ highway: "steps", step_count: "40", width: "10" });
    expect(correctedLine(run).line).toBe(run.line);
    expect(correctedLine({ ...run, id: "w1305889409" })).toEqual({ ...run, id: "w1305889409" });
    // A change of type for a line (T-050) goes the same way.
    const works = new Map([["w65351909", { id: "w65351909", tags: { highway: "path" }, reason: "ścieżka po remoncie", ref: "T-050" }]]);
    expect(correctedLine({ ...run, id: "w65351909", tags: { highway: "construction" } }, works).tags.highway).toBe("path");
  });

  // NMPT GUGiK 0.5 m (T-114), world y: the chapel's eaves about 7 and its nave's ridge 15.3, the keep's crown 16.4..16.9.
  it("puts the Trinity Chapel's eaves and ridge and the keep's crown in the game's data within 1 m of the surface model (G-204)", () => {
    const building = (id: string) => PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;
    const chapel = building("w66258167");
    expect(chapel.source).toBe("height");
    expect(Math.abs(chapel.y + chapel.height - 7)).toBeLessThanOrEqual(1);
    expect(Math.abs(chapel.y + chapel.height + (chapel.roof ?? 0) - 15.3)).toBeLessThanOrEqual(1);
    const keep = building("w450180469");
    expect(Math.abs(keep.y + keep.height + (keep.roof ?? 0) - 16.65)).toBeLessThanOrEqual(1);
  });

  // NMPT GUGiK 0.5 m (T-129), world y: St Nicholas's belfry to 15.7 (about 18 m over the ground at
  // y -2.5); St Josaphat's tower to 9.5 in its outline, 10.1 within 4 m of its middle, some 3 m
  // under the church's ridge (y 13.3).
  it("puts the tops of St Nicholas's belfry and St Josaphat's tower in the game's data within 1 m of the surface model (G-224)", () => {
    const top = (chunks: typeof PODZAMCZE_CHUNKS, id: string) => {
      const b = chunks.flatMap((c) => c.buildings).find((o) => o.id === id)!;
      expect(b.source, id).toBe("height");
      return b.y + b.height + (b.roof ?? 0);
    };
    expect(Math.abs(top(PODZAMCZE_CHUNKS, "w680377807") - 15.7)).toBeLessThanOrEqual(1);
    expect(Math.abs(top(KRAKOWSKIE_CHUNKS, "w1382552285") - 10.1)).toBeLessThanOrEqual(1);
  });

  // The flights and landings of the castle stairs, from Plac Zamkowy up to the gate's bridge (T-113),
  // as mapped: [x, z] of each way's ends. Their walls w231832094 and w231832095 stand 9.6..10.1 m apart.
  const FLIGHTS: readonly (readonly [number, number, number, number])[] = [
    [767.0, 244.8, 768.3, 244.7], // w1435832499
    [776.8, 244.0, 781.4, 243.6], // w1305940836
    [784.7, 243.4, 800.3, 242.5], // w1305889408
    [802.7, 242.4, 806.6, 242.1], // w1305940837
    [824.9, 240.1, 829.2, 239.5], // w1306105687
  ];
  const ground = PODZAMCZE_CHUNKS.flatMap((c) => c.ground);
  const inside = (x: number, z: number, o: readonly number[]) => {
    let hit = false;
    for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
      if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
    }
    return hit;
  };
  /** The surface drawn on top at (x, z): the last piece in draw order, or null for bare terrain. */
  const surfaceAt = (x: number, z: number) => ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);

  it("lays each flight of the castle stairs at least 9.5 m wide, as its walls stand (G-203)", () => {
    for (const [x0, z0, x1, z1] of FLIGHTS) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const [nx, nz] = [-(z1 - z0) / len, (x1 - x0) / len];
      const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
      const on = (v: number) => surfaceAt(mx + nx * v, mz + nz * v) === "steps";
      let [left, right] = [0, 0];
      while (left < 15 && on(left + 0.1)) left += 0.1;
      while (right < 15 && on(-right - 0.1)) right += 0.1;
      expect(left + right, `flight at ${mx.toFixed(0)},${mz.toFixed(0)}`).toBeGreaterThanOrEqual(9.5);
    }
  });

  it("joins the castle stairs' landings to their flights with no bare ground between them (G-203)", () => {
    const bare: string[] = [];
    for (let k = 0; k + 1 < FLIGHTS.length; k++) {
      const [x0, z0] = [FLIGHTS[k]![2], FLIGHTS[k]![3]];
      const [x1, z1] = [FLIGHTS[k + 1]![0], FLIGHTS[k + 1]![1]];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const [nx, nz] = [-(z1 - z0) / len, (x1 - x0) / len];
      // From 0.2 m off the joints: on the joint line itself a point lies on both bands' edges.
      for (let s = 0.2; s <= len - 0.2; s += 0.5) {
        for (let v = -4.5; v <= 4.5; v += 0.5) {
          const [x, z] = [x0 + ((x1 - x0) * s) / len + nx * v, z0 + ((z1 - z0) * s) / len + nz * v];
          const surface = surfaceAt(x, z);
          if (surface === null || surface === "grass") bare.push(`${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    }
    expect(bare.join(" ")).toEqual("");
  });
});
