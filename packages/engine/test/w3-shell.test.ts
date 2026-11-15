import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { W3_ROOF, W3_Y, WORLD_CHUNKS } from "@seki/sim";
import { facadeStyle } from "../src/renderer/mapcity/facade-style";
import { LANDMARK_NEAR, SKYLINE_LANDMARKS, addLandmarks, planSkyline } from "../src/renderer/mapcity/skyline";

/**
 * What the renderer draws of W-3 (ADR-0082 stage 1): the hall's walls the map city draws keep
 * their drawn roof on the solid's (the industrial facade's parapet is 1.2 m), and the castle
 * group's silhouette in the skyline stands where the map's castle does, as tall.
 */

const PARAPET = 1.2;

describe("W-3's shell drawn by the map city (ADR-0082)", () => {
  it("draws each of its buildings' roofs at the top of its solid, under a 1.2 m parapet", () => {
    const shell = WORLD_CHUNKS.flatMap((c) => c.props).filter((p) => p.scenery && p.view.kind === "building" && p.view.use === "industrial" && p.center.y === W3_Y);
    expect(shell.length).toBeGreaterThanOrEqual(3);
    for (const p of shell) {
      if (p.view.kind !== "building") continue;
      const area = 600;
      const style = facadeStyle({ use: p.view.use, levels: p.view.levels, height: p.view.height, look: p.view.look, area, width: 10 });
      expect(style.attic).toBe("parapet");
      expect(Math.min(style.atticHeight, PARAPET)).toBeCloseTo(PARAPET, 6);
      const top = Math.max(...(p.prisms ?? []).map((q) => q.top));
      // Row S is walked on (its roof at +10.4); the halls over it end at their drawn tops.
      expect(top === W3_ROOF || top === p.view.height, `${p.center.x},${p.center.z}`).toBe(true);
      if (top === W3_ROOF) expect(p.view.height - PARAPET).toBeCloseTo(W3_ROOF, 6);
    }
  });
});

describe("the castle group in the skyline (ADR-0082)", () => {
  const building = (id: string) => LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;

  it("stands on the map's castle and keep, as tall as they are with the castle's roof", () => {
    const castle = building("w48500136");
    const keep = building("w450180469");
    const parts = SKYLINE_LANDMARKS.find((l) => l.name === "Zamek")!.parts;
    const tower = parts.find((p) => p.octagon)!;
    expect(Math.hypot(tower.x - keep.x, tower.z - keep.z)).toBeLessThan(1);
    expect(tower.y0).toBeCloseTo(keep.y, 1);
    expect(tower.y1).toBeCloseTo(keep.y + keep.height, 1);
    for (const p of parts.filter((q) => !q.octagon)) {
      expect(p.y0).toBeCloseTo(castle.y, 1);
      expect(p.y1).toBeCloseTo(castle.y + castle.height + (castle.roof ?? 0) - 1, 1);
      expect(Math.hypot(p.x - castle.x, p.z - castle.z)).toBeLessThan(70);
    }
  });

  it("stands the chapel on the map's, its walls and its roof's ridge as tall", () => {
    const chapel = building("w66258167");
    const [walls, ridge] = SKYLINE_LANDMARKS.find((l) => l.name === "Kaplica")!.parts;
    expect(Math.hypot(walls!.x - chapel.x, walls!.z - chapel.z)).toBeLessThan(1.5);
    expect(walls!.y0).toBeCloseTo(chapel.y, 1);
    expect(walls!.y1).toBeCloseTo(chapel.y + chapel.height, 1);
    expect(ridge!.y1).toBeCloseTo(chapel.y + chapel.height + (chapel.roof ?? 0), 1);
  });

  it("is in the skyline's towers' mesh after the towers, marked so its vertices go within 600 m of it", () => {
    expect([...planSkyline().towers.uvs2].some((v, i) => i % 2 === 0 && v < -1.5)).toBe(false);
    const plan = addLandmarks(planSkyline());
    let marked = 0;
    for (let i = 0; i < plan.towers.vertexCount; i++) if ((plan.towers.uvs2[i * 2] ?? 0) < -1.5) marked++;
    expect(marked).toBe(SKYLINE_LANDMARKS.flatMap((l) => l.parts).reduce((n, p) => n + (p.octagon ? 2 : 1) * 20, 0));
    // From W-3's pier the castle is 1.6 km off: drawn; from Plac Zamkowy it is not.
    expect(Math.hypot(2470 - 887.6, 430 - 234)).toBeGreaterThan(LANDMARK_NEAR);
    expect(Math.hypot(760 - 887.6, 300 - 234)).toBeLessThan(LANDMARK_NEAR);
  });
});
