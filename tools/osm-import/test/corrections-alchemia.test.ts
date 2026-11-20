import { describe, expect, it } from "vitest";
import { ALCHEMIA_NAV, MAIN_WAY_X, P1_RAMP, P1_STAIR, entrancePieces } from "../../../packages/sim/src/content/alchemia/index.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain.ts";
import { ALCHEMIA_AREAS, REPLACED_WAYS, T0_LAWNS, withoutReplaced } from "../src/corrections-alchemia.ts";
import { pointInRing } from "../src/geometry.ts";

const CAR_PARK_RING = ALCHEMIA_AREAS.find((a) => a.id === "T-241/plac-t0")!.ring;

/** The map's ways a set piece of the game replaces (ADR-0074 stage 7): left out of the import, each with its register's row. */

const pt = (x: number, z: number) => ({ x, z });

describe("the ways the game replaces (ADR-0042, ADR-0074 stage 7)", () => {
  it("names each replaced way's set piece, reason and register entry, once", () => {
    for (const w of REPLACED_WAYS) {
      expect(w.id).toMatch(/^w\d+$/);
      expect(w.by.length).toBeGreaterThan(3);
      expect(w.reason.length).toBeGreaterThan(10);
      expect(w.ref).toMatch(/^T-\d{3}$/);
    }
    expect(new Set(REPLACED_WAYS.map((w) => w.id)).size).toBe(REPLACED_WAYS.length);
  });

  it("replaces Alchemia's car park and its two aisles with T0's square (T-241, G-500)", () => {
    expect(REPLACED_WAYS.filter((w) => w.ref === "T-241").map((w) => w.id).sort()).toEqual(["w173531008", "w173567309", "w177513189"]);
  });

  it("leaves out the plot's fence round Alchemia, which would close its ways in (T-145, ADR-0077)", () => {
    expect(REPLACED_WAYS.filter((w) => w.ref === "T-145").map((w) => w.id)).toEqual(["w783241007"]);
    expect(KRAKOWSKIE_CHUNKS.flatMap((c) => c.barriers ?? []).some((b) => b.id === "w783241007")).toBe(false);
  });

  // The generated chunk: the car park's asphalt and its aisles are gone, T0 is a square of setts
  // with two lawns cut out of it (the third, by Bajkowskiego, went with ADR-0074 C5), Lubartowska's lane line runs on past the old way out (447; 16).
  const chunk = KRAKOWSKIE_CHUNKS.find((c) => c.id === "krakowskie-2-1")!;
  const inside = (x: number, z: number, o: readonly number[]) => {
    let hit = false;
    for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
      if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
    }
    return hit;
  };
  /** The surface drawn on top at (x, z): the last piece in draw order, or null for bare terrain. */
  const surfaceAt = (x: number, z: number) => chunk.ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);
  const lawnAt = (x: number, z: number) => T0_LAWNS.some((l) => pointInRing({ x, z }, l.ring));

  /** The driveway from Bajkowskiego to the ramp's top, between the ramp's walls. */
  const drivewayAt = (x: number, z: number) => x > 409.7 && x < 418.3 && z < -5.5;

  it("paves T0 with no asphalt left on it but the ramp's driveway, the lawns green, and keeps no car park there", () => {
    const off: string[] = [];
    for (let x = 381.5; x < 440; x += 1)
      for (let z = -8.5; z < 38; z += 1) {
        if (!pointInRing({ x, z }, CAR_PARK_RING)) continue;
        const s = surfaceAt(x, z);
        if (s !== (lawnAt(x, z) ? "grass" : drivewayAt(x, z) ? "road" : "square")) off.push(`${x},${z} ${s}`);
      }
    expect(off.slice(0, 20).join(" ")).toEqual("");
    expect((chunk.carParks ?? []).map((p) => p.id)).not.toContain("w173531008");
  });

  it("leaves Bajkowskiego's footway and Lubartowska's footway as they were, Lubartowska's carriageway the deptak's setts (T-324)", () => {
    expect(surfaceAt(400, -10.9)).toBe("footway");
    expect(surfaceAt(437.6, 4)).toBe("footway");
    expect(surfaceAt(446, 16)).toBe("cobble");
    // The junction of Bajkowskiego and Lubartowska w40050981 stays asphalt; the deptak has no painted lanes.
    expect(surfaceAt(440.5, -17)).toBe("road");
    const onDeptak = (m: { line: readonly number[] }) => m.line.some((v, k) => k % 2 === 1 && v > -9 && v < 42 && m.line[k - 1]! > 438 && m.line[k - 1]! < 458);
    expect((chunk.markings ?? []).filter((m) => m.kind === "lane-dash" && onDeptak(m))).toHaveLength(0);
  });

  it("drives from Bajkowskiego's carriageway onto the ramp's top across the footway, which runs on over it", () => {
    // Along the ramp's lanes from the carriageway to its top: asphalt, the footway, asphalt, asphalt to the top.
    for (const x of [411.6, 414.9]) {
      const way: string[] = [];
      for (let z = -13.6; z <= -5.6; z += 0.2) {
        const s = surfaceAt(x, z) ?? "bare";
        if (way[way.length - 1] !== s) way.push(s);
      }
      expect(way, `x ${x}`).toEqual(["road", "footway", "road"]);
    }
  });

  /** Where `at` along a to b (0.02 steps, both ends) is not drawn as one of `want`: "x,z surface". */
  const offAlong = (a: { x: number; z: number }, b: { x: number; z: number }, want: ReadonlySet<string>): string[] => {
    const off: string[] = [];
    for (let k = 0; k <= 50; k++) {
      const [x, z] = [a.x + ((b.x - a.x) * k) / 50, a.z + ((b.z - a.z) * k) / 50];
      const s = surfaceAt(x, z);
      if (!want.has(s ?? "bare")) off.push(`${x.toFixed(2)},${z.toFixed(2)} ${s ?? "bare"}`);
    }
    return off;
  };
  const SQUARE: ReadonlySet<string> = new Set(["square"]);
  const PAVED: ReadonlySet<string> = new Set(["square", "footway", "sidewalk", "cobble"]);

  // ADR-0093 O2b moved P-1's stair house east, onto the east lawn's west end: its door opened onto the grass.
  it("keeps T0's setts 1.5 m before P-1's stair house's door and along the level graph's way to it from the main entrance's way (G-940)", () => {
    const d = P1_STAIR.door;
    const off: string[] = [];
    for (let z = P1_STAIR.minZ - 1.5; z < P1_STAIR.minZ - 0.05; z += 0.25) off.push(...offAlong({ x: d.x0, z }, { x: d.x1, z }, SQUARE));
    const at = new Map(ALCHEMIA_NAV.nodes.map((n) => [n.id, n.at]));
    const [axis, door] = ["alchemia-t0-axis", "alchemia-p1-stair-out"];
    expect(ALCHEMIA_NAV.edges.some((e) => (e.a === axis && e.b === door) || (e.a === door && e.b === axis))).toBe(true);
    off.push(...offAlong(at.get(axis)!, at.get(door)!, SQUARE));
    expect(off.slice(0, 20).join(" ")).toEqual("");
  });

  // The main entrance's way (ADR-0093 O2b) runs over the car park's notch by the pavilion, bare ground, and a strip
  // of it was left between the footway's band and the square at the way's mouth.
  it("paves the main entrance's way from Bajkowskiego's footway to z 0 and under its strips of light in the paving (G-941)", () => {
    const off: string[] = [];
    for (let x = MAIN_WAY_X - 2; x <= MAIN_WAY_X + 2 + 1e-6; x += 0.25) off.push(...offAlong({ x, z: P1_RAMP.top - 0.8 }, { x, z: 0 }, PAVED));
    const strips = entrancePieces().filter((p) => p.kind === "led-green" && p.box.y1 < groundY(p.box.x0, p.box.z0) + 0.5);
    expect(strips.length).toBeGreaterThan(20);
    for (const { box: b } of strips) for (const x of [b.x0, b.x1]) off.push(...offAlong({ x, z: b.z0 }, { x, z: b.z1 }, PAVED));
    expect(off.slice(0, 20).join(" ")).toEqual("");
  });

  it("leaves out the replaced areas and lines by id, and the rest as mapped", () => {
    const area = { id: "w1", osmId: 1, tags: { amenity: "parking" }, ring: [pt(0, 0), pt(1, 0), pt(1, 1)], holes: 0 };
    const line = { id: "w2", osmId: 2, tags: { highway: "service" }, line: [pt(0, 0), pt(1, 1)] };
    const other = { ...line, id: "w3", osmId: 3 };
    const f = { areas: [area], lines: [line, other] };
    expect(withoutReplaced(f, new Set(["w1", "w2"]))).toEqual({ areas: [], lines: [other] });
    expect(withoutReplaced(f, new Set())).toEqual({ areas: [area], lines: [line, other] });
  });
});
