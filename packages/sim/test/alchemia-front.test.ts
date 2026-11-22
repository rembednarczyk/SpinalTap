import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_PROPS,
  MALL_PROPS,
  SHOP_SOLID_PROPS,
  FOODHALL_SOLID_PROPS,
  ROOF_SOLID_PROPS,
  FRONT_PLAZA_SOLID_PROPS, DEPTAK_SOLID_PROPS, FRONT_O5_PROPS,
  EAST_WING,
  FRONT_SIGN,
  L1_TOP,
  L2_SLABS,
  L2_TOP,
  L3,
  L3_TOP,
  P1_RAMP,
  P2_ROBOTS,
  SHELTER_PROPS,
  CAR_LIFT_PROPS,
  P1_STAIR,
  PASSAGE_COLUMNS,
  PAVILION_CORNERS,
  MALL_LEVELS,
  WEST_WING,
  frontPieces,
  FOUNTAIN,
  FRONT_KIOSKS,
  ROOM_ID_BASE,
  Simulation,
  groundY,
  DEPTAK_NIGHT_SOLID_PROPS,
} from "../src";
import { teleportPlayer } from "./helpers";

/**
 * Alchemia's front on Bajkowskiego (ADR-0074, B1, decisions of 19.11): the complex fills the
 * site over P-1, its storeys stepping back from the street on the tiers' levels, the passage
 * under L2 left to the ramp, P-1's stair house and metro B.
 */

type R = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
const apart = (a: R, b: R, gap: number): boolean => a.maxX + gap <= b.minX || b.maxX + gap <= a.minX || a.maxZ + gap <= b.minZ || b.maxZ + gap <= a.minZ;
/** Metro B's pavilion before Alchemia (`plan.ts`), open east to Lubartowska. */
const METRO_B: R = { minX: 424.4, maxX: 431.6, minZ: 26.2, maxZ: 29.8 };

describe("Alchemia's front over P-1 (B1)", () => {
  it("lays its roofs on the gallery's floors, L3 a storey over L2 on its roof", () => {
    // On the levels of tiers A and B until ADR-0093 O1, now the gallery's P2, P3 and roof (the same heights).
    expect(L1_TOP).toBe(MALL_LEVELS.p2);
    expect(L2_TOP).toBe(MALL_LEVELS.p3);
    expect(L3_TOP).toBe(MALL_LEVELS.roof);
    expect(L3_TOP - L2_TOP).toBeCloseTo(4.2, 6);
    // Twelve metres and more over Bajkowskiego's footway.
    expect(L3_TOP - groundY(410, -8.8)).toBeGreaterThan(11);
  });

  it("steps back from the street: the wings' fronts, then L2's, then L3's", () => {
    const l1 = Math.min(...WEST_WING.map((r) => r.minZ));
    const l2 = Math.min(...L2_SLABS.map((r) => r.minZ));
    expect(l1).toBeLessThan(l2);
    expect(l2).toBeLessThan(L3.minZ);
    expect(L3.minZ - l2).toBeGreaterThanOrEqual(6);
  });

  it("keeps its wings and columns off the ramp's trench, P-1's stair house, the pavilions and metro B's way", () => {
    expect(EAST_WING.minX).toBe(P1_STAIR.maxX);
    const trench: R = { minX: P1_RAMP.minX - 0.3, maxX: P1_RAMP.maxX + 0.3, minZ: P1_RAMP.top, maxZ: P1_RAMP.covered };
    const columns = PASSAGE_COLUMNS.map((c) => ({ minX: c.x - 0.3, maxX: c.x + 0.3, minZ: c.z - 0.3, maxZ: c.z + 0.3 }));
    const pavilion: R = { minX: Math.min(...PAVILION_CORNERS.map((c) => c.x)), maxX: Math.max(...PAVILION_CORNERS.map((c) => c.x)), minZ: Math.min(...PAVILION_CORNERS.map((c) => c.z)), maxZ: Math.max(...PAVILION_CORNERS.map((c) => c.z)) };
    for (const r of [...WEST_WING, EAST_WING, ...columns]) {
      expect(apart(r, trench, 0.5), JSON.stringify(r)).toBe(true);
      // ADR-0093 O2b: the stair house stands against the east wing's west face (moved off the main entrance's way), off everything else.
      expect(apart(r, P1_STAIR, r === EAST_WING ? 0 : 0.5), JSON.stringify(r)).toBe(true);
      expect(apart(r, pavilion, 2), JSON.stringify(r)).toBe(true);
      expect(apart(r, METRO_B, 1.5), JSON.stringify(r)).toBe(true);
    }
  });

  it("stands the east wing's screen on a plinth of its outline down into the ground (the user's 20.11)", () => {
    const pieces = frontPieces();
    const screen = pieces.find((p) => p.kind === "screen" && p.box.z1 === EAST_WING.minZ)!;
    const s = screen.box;
    const plinth = pieces.find((p) => p !== screen && p.box.x0 === s.x0 && p.box.x1 === s.x1 && p.box.z0 === s.z0 && p.box.z1 === s.z1 && p.box.y1 === s.y0);
    expect(plinth, "a plinth under the screen").toBeDefined();
    for (let x = s.x0; x <= s.x1; x += 0.5) expect(plinth!.box.y0).toBeLessThan(groundY(x, s.z0) - 0.3);
  });

  it("leaves the passage under L2 2.9 m and more over its ground", () => {
    const soffit = L1_TOP - 0.35;
    for (let x = 405; x <= 435; x += 2) {
      for (let z = 4; z <= 31; z += 2) {
        if (!L2_SLABS.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) continue;
        expect(soffit - groundY(x, z), `${x},${z}`).toBeGreaterThan(2.9);
      }
    }
  });

  it("faces its sign to Bajkowskiego on L3's south face, a prop of its own the last of Alchemia's", () => {
    // In front of L3's slab and its edge (0.3 m out of the glass), as the board's lightbox (C4).
    expect(FRONT_SIGN.z1).toBeLessThanOrEqual(L3.minZ - 0.3);
    expect(FRONT_SIGN.y0).toBeGreaterThan(L2_TOP);
    // C4 lifted it: its foot over the line of sight from the square across L2's hedge (some 8.8 m up
    // on L3's face), its top a metre over the roof's edge (it stood under the slab's beam, L3_TOP - 0.7,
    // and showed from the square only the top of ALCHEMIA). Drawn only: no solid over the roof.
    expect(FRONT_SIGN.y0).toBeGreaterThan(8.3);
    expect(FRONT_SIGN.y1).toBeLessThanOrEqual(L3_TOP + 1.0);
    expect(frontPieces().find((p) => p.kind === "sign")!.solid).toBe(false);
    // The green roof's solids (ADR-0093 O4) come after the food hall's, then the square before the front (ADR-0074 C5) and the
    // deptak's (C7), then the front's storeys as rooms (O5), the last of Alchemia's. Since O5 the front's own slot holds only its
    // solids on the ground (the green steps, the house with arcades' piers): one walks in its storeys, a prop per tile among the last.
    const slot = ALCHEMIA_PROPS.at(-1 - P2_ROBOTS.length - SHELTER_PROPS.length - CAR_LIFT_PROPS.length - MALL_PROPS.length - SHOP_SOLID_PROPS.length - FOODHALL_SOLID_PROPS.length - ROOF_SOLID_PROPS.length - FRONT_PLAZA_SOLID_PROPS.length - DEPTAK_SOLID_PROPS.length - (FRONT_O5_PROPS.length + DEPTAK_NIGHT_SOLID_PROPS.length))!;
    expect(slot.prisms).toHaveLength(frontPieces().filter((p) => p.solid && p.box.y0 <= -2.9 && (p.kind === "green" || p.kind === "plaster")).length);
  });

  it("stands its kiosks (B4) on the square before it, off the fountain, the ramp's trench and every solid of the map", () => {
    const trench: R = { minX: P1_RAMP.minX - 1.2, maxX: P1_RAMP.maxX + 0.9, minZ: P1_RAMP.top, maxZ: P1_RAMP.covered };
    for (const k of FRONT_KIOSKS) {
      expect(apart(k, FOUNTAIN, 1), JSON.stringify(k)).toBe(true);
      expect(apart(k, trench, 2), JSON.stringify(k)).toBe(true);
      for (const w of WEST_WING) expect(apart(k, w, 2), JSON.stringify(k)).toBe(true);
    }
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, { x: 400, y: groundY(400, -9.5), z: -9.5 });
    sim.step();
    for (const k of FRONT_KIOSKS) {
      const hits = [...sim.world.with("solid")].filter((e) => e.id < ROOM_ID_BASE && e.solid.min.x < k.maxX + 0.3 && e.solid.max.x > k.minX - 0.3 && e.solid.min.z < k.maxZ + 0.3 && e.solid.max.z > k.minZ - 0.3 && e.solid.max.y > groundY(k.minX, k.minZ) - 0.5);
      expect(hits.map((e) => `${e.key ?? e.id} ${e.view?.kind}`), JSON.stringify(k)).toEqual([]);
    }
  });
});
