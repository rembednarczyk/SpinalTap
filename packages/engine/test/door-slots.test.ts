import { describe, expect, it } from "vitest";
import { type FacadeFrame, type MapBuilding, type Wall, facadeFrame, frameWallMeta } from "../src/renderer/mapcity/facade-frame";
import { WINDOW_STYLE } from "../src/renderer/mapcity/facade-style";
import { doorSlots, groundGlass } from "../src/renderer/mapcity/door-slots";
import { type VenueBoard, venueBoards } from "../src/renderer/mapcity/venue-plan";
import { type P2, cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * Where a door may stand on a facade (ADR-0058 stage 9), against the facade shader itself: the
 * glass mask of `facadeGlass` (`npr/toon-city.ts`) ported line by line, sampled round each slot.
 * A door beside a pane at its height, or a pane running on past a door that covers it, would be a
 * door in a window.
 */

const fract = (v: number) => v - Math.floor(v);
const step = (e: number, x: number) => (x < e ? 0 : 1);

/** `facadeGlass`'s mask (alpha) on the ground floor, near (detail 1), as the GLSL computes it. */
const shaderMask = (q: { x: number; y: number }, meta: readonly [number, number]): number => {
  const storey = Math.floor(meta[0] + 0.0005) / 10;
  const bay = Math.floor(fract(meta[0]) * 1000 + 0.5) / 100;
  const code = Math.floor(meta[1] + 0.0005);
  const seed = (Math.floor(fract(meta[1]) * 256) + 0.5) / 256;
  const shop = step(7.5, code) * (1 - step(15.5, code));
  const style = code - 8 * shop;
  if (storey < 0.05 || style > 15.5) return 0;
  const ground = storey * 1.25;
  const church = step(3.5, style) * step(style, 4.5);
  if (q.y < ground && shop > 0.5 && church < 0.5) {
    const sb = bay * (fract(seed * 3.1) > 0.5 ? 1 : 2);
    const u = fract(q.x / sb);
    return step(0.05, u) * step(u, 0.95) * step(0.45, q.y) * step(q.y, ground - 0.85);
  }
  const row = Math.floor((q.y - ground) / storey) + 1;
  const fy = q.y < ground ? q.y / ground : fract((q.y - ground) / storey);
  const c = Math.floor(q.x / bay);
  const u = fract(q.x / bay);
  const win = (s: number): number => {
    if (s < 1.5) return step(0.3, u) * step(u, 0.7) * step(0.24, fy) * step(fy, 0.8);
    if (s < 2.5) return step(0.1, u) * step(u, 0.9) * step(0.25, fy) * step(fy, 0.84);
    if (s < 3.5) return step(0.28, u) * step(u, 0.72) * step(0.2, fy) * step(fy, 0.86);
    if (s < 4.5) return 1;
    if (s < 5.5) return step(0.04, u) * step(u, 0.96) * step(0.56, fy) * step(fy, 0.8);
    return step(0.2, u) * step(u, 0.8) * step(0.3, fy) * step(fy, 0.76);
  };
  let rect = win(style);
  // The gate may be painted in the second bay of a tenement (by a hash of the seed): taken as painted.
  if (row < 0.5 && style < 1.5) {
    const gate = step(Math.abs(c - 1), 0.5);
    rect = Math.max(rect * (1 - gate), gate * step(0.16, u) * step(u, 0.84) * step(q.y, ground * 0.8) * step(0, q.y));
  }
  return rect;
};

const rect = (w: number, d: number): P2[] =>
  cleanRing([
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: d },
    { x: 0, z: d },
  ]);

const building = (over: Partial<MapBuilding>): MapBuilding => ({ id: 1, ring: rect(23, 12), base: 0, foot: 0, height: 15, levels: 4, use: "historic", look: 1, shopfront: false, ...over });

/** Every slot of every wall clear of the shader's panes beside it and above it. */
const slotsAgainstShader = (f: FacadeFrame): { slots: number; bad: string[] } => {
  const bad: string[] = [];
  let slots = 0;
  for (const w of f.walls) {
    const meta = frameWallMeta(f, w);
    for (const s of doorSlots(f, w)) {
      slots++;
      for (let y = 0.05; y < s.max - 0.01; y += 0.05) {
        for (const x of [s.u - s.width / 2 - 0.02, s.u + s.width / 2 + 0.02]) if (shaderMask({ x, y }, meta) > 0) bad.push(`pane beside the door at u ${x.toFixed(2)}, y ${y.toFixed(2)} (${s.cover ? "cover" : "pier"})`);
      }
      for (let x = s.u - s.width / 2; x <= s.u + s.width / 2; x += 0.05) if (shaderMask({ x, y: s.top + 0.03 }, meta) > 0) bad.push(`pane above the door at u ${x.toFixed(2)}`);
    }
  }
  return { slots, bad };
};

describe("door slots on the facades (ADR-0058 stage 9)", () => {
  it("keep off the shader's panes or cover one whole, over many looks and styles", () => {
    let total = 0;
    let covers = 0;
    for (let look = 1; look < 60; look++) {
      for (const over of [{ use: "historic" }, { use: "commercial", shopfront: true }, { use: "residential", levels: 7 }, { use: "industrial", levels: 1, height: 7 }, { use: "civic" }, { use: "commercial" }] as const) {
        const f = facadeFrame(building({ look, ...over }), () => null);
        const { slots, bad } = slotsAgainstShader(f);
        expect(bad, `look ${look} ${over.use}`).toEqual([]);
        total += slots;
        covers += f.walls.flatMap((w) => doorSlots(f, w)).filter((s) => s.cover).length;
      }
    }
    expect(total).toBeGreaterThan(1000);
    expect(covers).toBeGreaterThan(100);
  });

  it("a tenement's door stands between its windows or takes one whole, off the gate's bay", () => {
    const f = facadeFrame(building({ look: 3 }), () => null);
    expect(f.style.window).toBe(WINDOW_STYLE.tenement);
    const w = f.walls[0]!;
    const meta = frameWallMeta(f, w);
    const bay = Math.floor((meta[0] % 1) * 1000 + 0.5) / 100;
    const slots = doorSlots(f, w);
    expect(slots.length).toBeGreaterThan(2);
    expect(slots.some((s) => s.cover)).toBe(true);
    expect(slots.some((s) => !s.cover)).toBe(true);
    for (const s of slots) {
      // A window's door in its middle, a pier's at a bay's edge (or in the narrower piers beside the gate); neither over the gate's bay (the second).
      const k = s.u / bay + (s.cover ? 0.5 : 0);
      if (s.cover || s.u > 2.3 * bay || s.u < 0.7 * bay) expect(Math.abs(k - Math.round(k))).toBeLessThan(0.02);
      expect(s.u + s.width / 2 <= 1.16 * bay || s.u - s.width / 2 >= 1.84 * bay).toBe(true);
    }
  });

  it("a shop's door takes a whole shop window under the board, with its fanlight to the pane's top", () => {
    const f = facadeFrame(building({ use: "commercial", shopfront: true, look: 5, venues: [{ x: 11.5, z: 0, name: "KLONOWY STÓŁ", color: "#ff2e88" }] }), () => null);
    const w = f.walls.find((x) => groundGlass(f, x).length > 0)!;
    const covers = doorSlots(f, w).filter((s) => s.cover);
    expect(covers.length).toBeGreaterThan(0);
    const pane = groundGlass(f, w)[0]!;
    for (const s of covers) expect(s.top).toBeCloseTo(pane.y1 + 0.01, 6);
  });

  it("keeps under a venue's board: a slot reaching into it goes, a pier's door gets lower", () => {
    const f = facadeFrame(building({ use: "commercial", shopfront: true, look: 5 }), () => null);
    const w = f.walls[0]!;
    const free = doorSlots(f, w, []);
    const board: VenueBoard = { wall: w, u: w.length / 2, y: 2.4, width: w.length, height: 0.6, glyph: 0.5, squeeze: 1, text: "X", color: "#ffffff" };
    const under = doorSlots(f, w, [board]);
    expect(free.some((s) => s.cover)).toBe(true);
    // The board's bottom at 2.1 m: under the shop windows' tops, so no cover, and the piers go too (under 2.1 m).
    expect(under.filter((s) => s.cover)).toEqual([]);
    for (const s of under) expect(s.max).toBeLessThanOrEqual(2.1 - 0.005 + 1e-9);
  });

  it("none on a party wall, a wall with the game's doorway or a church's", () => {
    const party = facadeFrame(building({ look: 3 }), () => 30);
    expect(party.walls.flatMap((w) => doorSlots(party, w))).toEqual([]);
    const doorway = facadeFrame(building({ look: 3, doorways: [{ x: 5, z: 0, width: 1.4, bottom: 0, top: 2.4 }] }), () => null);
    expect(doorway.walls.flatMap((w) => doorSlots(doorway, w))).toEqual([]);
    const church = facadeFrame(building({ use: "church", look: 3 }), () => null);
    expect(church.walls.flatMap((w) => doorSlots(church, w))).toEqual([]);
  });

  it("a wall without windows takes a door every metre", () => {
    const f = facadeFrame(building({ use: "garage", look: 2 }), () => null);
    const w: Wall = f.walls[0]!;
    const slots = doorSlots(f, w);
    expect(slots.length).toBeGreaterThanOrEqual(Math.floor(w.length - 2));
    expect(venueBoards(f)).toEqual([]);
  });
});
