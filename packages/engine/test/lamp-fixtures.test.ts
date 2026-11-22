import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { ALCHEMIA_PIECES, ATRIUM, P2, P2_STORE_PIECES, SHELTER_PIECES, WORLD_SCENERY } from "@seki/sim";
import { ALCHEMIA_LAMPS } from "../src/renderer/alchemia/alchemia-lights";

/*
 * No light from nowhere (`docs/zasady-lokacji.md` §13, the user's rule of 22.11): every lamp of the
 * renderer's in Alchemia hangs by something that gives light in the picture, a fitting, a lantern, a
 * shop's sign or screen, a robot's beacon, within `REACH` of it and on its storey. The atrium's lamps
 * are the cyan strips under its slabs' edges (drawn with the slabs): they hang on those edges.
 */

const REACH = 3;
const LIGHTY = /lamp|light|lantern|neon|led|lightbox|sign|display|screen|beacon/i;

const fixtures = (): { x: number; y: number; z: number }[] => {
  const out: { x: number; y: number; z: number }[] = [];
  for (const p of [...ALCHEMIA_PIECES, ...P2_STORE_PIECES, ...SHELTER_PIECES]) if (LIGHTY.test(p.kind)) out.push({ x: (p.box.x0 + p.box.x1) / 2, y: p.box.y1, z: (p.box.z0 + p.box.z1) / 2 });
  for (const s of WORLD_SCENERY) {
    if (s.view.kind !== "street-props") continue;
    for (const item of s.view.items) {
      const key = item.prop === "room-detail" ? (ROOM_DETAIL_SHAPES[item.variant % ROOM_DETAIL_SHAPES.length]?.key ?? "") : item.prop;
      if (LIGHTY.test(key)) out.push({ x: s.at.x + item.x, y: s.at.y + item.y, z: s.at.z + item.z });
    }
  }
  return out;
};

describe("no light from nowhere in Alchemia (rules of 22.11, §13)", () => {
  const all = fixtures();
  const nearest = (x: number, z: number, floor: number, top: number): number =>
    Math.min(...all.filter((f) => f.y >= floor - 0.2 && f.y <= top + 1).map((f) => Math.hypot(f.x - x, f.z - z)));

  it("hangs every lamp of its interior mode by a fitting on its storey, the atrium's on its slabs' lit edges", () => {
    const far: string[] = [];
    for (const { key, light } of ALCHEMIA_LAMPS) {
      if (key.includes("-atrium-")) {
        // On the middle of a long edge of the atrium, where its slab's strip runs.
        expect([ATRIUM.z0, ATRIUM.z1], key).toContain(light.position.z);
        continue;
      }
      const d = nearest(light.position.x, light.position.z, light.clip.minY, light.clip.maxY);
      if (d > REACH) far.push(`${key} ${d.toFixed(1)} m`);
    }
    expect(far).toEqual([]);
  });

  it("gives the gallery's strips on P1 and P2 their own ceiling fittings, and P-2's glow a beacon over its lane", () => {
    const panels = ALCHEMIA_PIECES.filter((p) => p.kind === "ceiling-light" && p.box.x0 > 407 && p.box.x1 < 429 && p.box.z0 > 36 && p.box.z1 < 54);
    // Four strips on two storeys, four panels each (every 4 m: west and east 16 m, south and north 14 m).
    expect(panels.length).toBe(32);
    expect(panels.every((p) => !p.solid)).toBe(true);
    const beacons = P2_STORE_PIECES.filter((p) => p.kind === "beacon" && p.box.y1 >= P2.ceiling - 0.01);
    expect(beacons.length).toBeGreaterThan(3);
  });
});
