import { describe, expect, it } from "vitest";
import { type BuildingUse, type StreetPropItem, type ViewDescriptor, grateVariant, graffitiVariant, plateVariant, stickerVariant } from "../../../packages/core/src";
import type { Wall } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { RECIPE_BY_OSM } from "../../../packages/engine/src/renderer/mapcity/landmarks/recipes";
import { shopBoardHeight, shopBoardOn } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { crossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import type { BoardSpan } from "../../osm-import/src/props-boards.ts";
import { type DrawnView, cityFrames } from "../../osm-import/src/venue-boards.ts";
import { type DecalWorld, decalChecks } from "./decal-pieces";

/**
 * The glitch scan's checks of the decals (ADR-0058 stage 6) on a small world of their own: each
 * check finds the decal put where it must not be, by every one of its conditions alone, and
 * nothing on the decals put right.
 */

type Pt = { readonly x: number; readonly z: number };
type BuildingView = Extract<ViewDescriptor, { kind: "building" }>;

const box = (x0: number, z0: number, x1: number, z1: number): Pt[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** A building view with its outline round its entity at the outline's middle. */
const building = (ring: readonly Pt[], height: number, use: BuildingUse, extra: Partial<BuildingView> = {}, y = 0): DrawnView => {
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p.z, 0) / ring.length;
  const view: BuildingView = {
    kind: "building",
    outline: ring.map((p) => ({ x: p.x - cx, z: p.z - cz })),
    height,
    levels: Math.max(1, Math.round(height / 3.2)),
    use,
    look: 7,
    ...extra,
  };
  return { view, at: { x: cx, y, z: cz } };
};

// A garage (no glass) at x 0..10 with a taller neighbour standing out in front of its south wall's
// east end (x 8..14, z -2..0); a tenement on a 1.2 m plinth (glazed) at x 20..30; a church on a
// plinth at x 40..50; a tall block at x 60..70 over a garage at x 70..74 (a firewall over it, 6 m of
// it in view: no holo-ad); a tall block at x 80..90 over a garage at x 90..92 (a holo-ad's firewall);
// a garage standing a metre up at x 0..10, z 30..36.
const VIEWS: DrawnView[] = [
  building(box(0, 0, 10, 6), 3, "garage"),
  building(box(8, -2, 14, 0), 8, "residential"),
  building(box(20, 0, 30, 10), 12, "residential", { plinth: 1.2 }),
  building(box(40, 0, 50, 10), 12, "church", { plinth: 1.2 }),
  building(box(60, 0, 70, 6), 10, "industrial"),
  building(box(70, 0, 74, 6), 4, "garage"),
  building(box(80, 0, 90, 8), 20, "residential"),
  building(box(90, 0, 92, 8), 4, "garage"),
  building(box(0, 30, 10, 36), 3, "garage", {}, 1),
];
// A landmark of the map where it stands, as the renderer matches it (its place and corner count), on a 2 m plinth.
const LANDMARK = LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((b) => RECIPE_BY_OSM.has(b.id) && b.soffit === undefined)!;
const outline = Array.from({ length: LANDMARK.outline.length / 2 }, (_, i) => ({
  x: LANDMARK.outline[i * 2]!,
  z: LANDMARK.outline[i * 2 + 1]!,
}));
VIEWS.push({
  view: {
    kind: "building",
    outline,
    height: LANDMARK.height,
    levels: LANDMARK.levels,
    use: LANDMARK.use,
    look: LANDMARK.look,
    plinth: 2,
  },
  at: { x: LANDMARK.x, y: LANDMARK.y, z: LANDMARK.z },
});

const FRAMES = cityFrames(VIEWS);
const frameAt = (x: number, z: number) => FRAMES.find((b) => Math.abs(b.at.x - x) < 0.01 && Math.abs(b.at.z - z) < 0.01)!;
/** The wall of the building at (x, z) whose outward normal is (nx, nz). */
const wallOf = (x: number, z: number, nx: number, nz: number): Wall => frameAt(x, z).frame.walls.find((w) => Math.abs(w.nx - nx) < 1e-6 && Math.abs(w.nz - nz) < 1e-6)!;
/** A decal on the wall at `s` (its x on a wall across z, its z on one across x), `out` off its face, its yaw turned by `turn`. */
const on = (w: Wall, prop: StreetPropItem["prop"], s: number, variant: number, { out = 0, turn = 0, y = 0 } = {}): StreetPropItem => {
  const p = Math.abs(w.nz) > 0.5 ? { x: s, z: w.a.z } : { x: w.a.x, z: s };
  return {
    prop,
    x: p.x + w.nx * out,
    y,
    z: p.z + w.nz * out,
    yaw: Math.atan2(w.nx, w.nz) + turn,
    variant,
  };
};
const graffiti = (width: number, height: number, lift: number) => graffitiVariant({ design: 1, width, height, lift });
const plate = (lift: number) => plateVariant({ number: 12, letter: 0, lift });

const GARAGE_S = wallOf(5, 3, 0, -1);
const RAISED_S = wallOf(5, 33, 0, -1);
const TENEMENT_S = wallOf(25, 5, 0, -1);
const CHURCH_S = wallOf(45, 5, 0, -1);
const FIREWALL = wallOf(65, 3, 1, 0);
const HOLO_WALL = wallOf(85, 4, 1, 0);

const BOARD: BoardSpan = {
  a: { x: 22, z: 0 },
  b: { x: 26, z: 0 },
  nx: 0,
  nz: -1,
  bottom: 5.5,
  top: 6.2,
  wallA: TENEMENT_S.a,
  wallB: TENEMENT_S.b,
  text: "BAR",
};

// A road at z -20..-12 with a sidewalk drawn over its last metre (z -13..-11), a zebra across it at x 50..54.
const ROAD = box(0, -20, 100, -12);
const SIDEWALK = box(0, -13, 100, -11);
const ZEBRA = crossingBand([50, -20, 54, -20, 54, -12, 50, -12])!;

const world = (patch: Partial<DecalWorld> = {}): DecalWorld => ({
  views: VIEWS,
  boards: [BOARD],
  passages: [{ from: { x: 5, z: -10 }, to: { x: 5, z: -8 }, width: 3 }],
  roads: [ROAD],
  sidewalks: [SIDEWALK],
  crossings: [ZEBRA],
  groundY: () => 0,
  surfaceY: () => 0,
  districtAt: () => "targ",
  tagsAt: () => ({}),
  poleLamp: () => false,
  ...patch,
});

const run = (items: readonly StreetPropItem[], patch: Partial<DecalWorld> = {}): Record<string, number> =>
  Object.fromEntries(Object.entries(decalChecks(items, world(patch))).map(([k, f]) => [k, f().length]));
/** Only `check` finds the items, each once. */
const only = (check: string, items: readonly StreetPropItem[], patch: Partial<DecalWorld> = {}) => {
  const counts = run(items, patch);
  expect(Object.keys(counts)).toContain(check);
  for (const [k, n] of Object.entries(counts)) expect(n, `${k} for ${check}`).toBe(k === check ? items.length : 0);
};
const none = (items: readonly StreetPropItem[], patch: Partial<DecalWorld> = {}) => {
  for (const [k, n] of Object.entries(run(items, patch))) expect(n, k).toBe(0);
};

describe("the glitch scan's decal checks (ADR-0058 stage 6)", () => {
  it("finds nothing on decals put right", () => {
    none([
      on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3)),
      on(GARAGE_S, "house-plate", 1, plate(2.2)),
      on(FIREWALL, "graffiti", 3, graffiti(3, 2, 4.5)),
      // In the tenement's and the church's plinths, under their ground floors at 1.2 m.
      on(TENEMENT_S, "graffiti", 27.5, graffiti(1.2, 0.6, 0.3)),
      on(CHURCH_S, "house-plate", 45, plateVariant({ number: 3, letter: 0, lift: 0.3 })),
      on(RAISED_S, "graffiti", 3, graffiti(2, 1, 0.3), { y: 1 }),
    ]);
    // A plate on a protected building is no graffiti.
    none([on(GARAGE_S, "house-plate", 1, plate(2.2))], {
      tagsAt: () => ({ historic: "yes" }),
      districtAt: () => "kanal",
    });
  });

  it("finds a wall decal off the wall's face, turned off its normal, past its ends, over its top, under the wall in view or under the paving", () => {
    only("decal-off-wall", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3), { out: 0.1 })]);
    only("decal-off-wall", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3), { turn: 0.1 })]);
    only("decal-off-wall", [on(GARAGE_S, "graffiti", 1.5, graffiti(4, 1, 0.3))]);
    only("decal-off-wall", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 2.3))]);
    only("decal-off-wall", [on(RAISED_S, "graffiti", 3, graffiti(2, 1, 0.3), { y: 0.5 })]);
    only("decal-off-wall", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], {
      surfaceY: () => 0.4,
    });
  });

  it("finds a wall decal over the ground floor of a glazed wall", () => {
    only("decal-in-window", [on(TENEMENT_S, "graffiti", 27.5, graffiti(1.2, 0.6, 0.8))]);
    only("decal-in-window", [on(TENEMENT_S, "house-plate", 27.5, plate(2.2))]);
  });

  it("finds a decal on a landmark, and graffiti on a protected building or in the Old Town", () => {
    const f = frameAt(LANDMARK.x, LANDMARK.z).frame;
    const w = f.walls.find((x) => x.length > 4 && !x.blind)!;
    const mid = Math.abs(w.nz) > 0.5 ? (w.a.x + w.b.x) / 2 : (w.a.z + w.b.z) / 2;
    const lm = {
      ...on(w, "house-plate", mid, plate(0.5), { y: LANDMARK.y }),
      x: (w.a.x + w.b.x) / 2,
      z: (w.a.z + w.b.z) / 2,
    };
    only("decal-on-landmark", [lm], { surfaceY: () => -100 });
    only("decal-on-landmark", [on(CHURCH_S, "graffiti", 45, graffiti(1, 0.5, 0.3))]);
    only("decal-on-landmark", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], { tagsAt: () => ({ historic: "yes" }) });
    only("decal-on-landmark", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], { tagsAt: () => ({ heritage: "2" }) });
    only("decal-on-landmark", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], { districtAt: () => "kanal" });
  });

  it("finds a wall decal reaching into a taller neighbour", () => {
    only("decal-in-neighbour", [on(GARAGE_S, "graffiti", 8.9, graffiti(1.6, 1, 0.3))]);
  });

  it("finds a wall decal under a venue's board, in a shop board's band or on a holo-ad's wall", () => {
    only("decal-on-sign", [on(HOLO_WALL, "graffiti", 4, graffiti(3, 2, 4.5))]);
    only("decal-on-sign", [on(TENEMENT_S, "graffiti", 24, graffiti(1, 0.6, 0.3))], { boards: [{ ...BOARD, bottom: 0.5, top: 1.0 }] });
    // A shop's street wall with its board's band (glazed, so the window's check finds it too).
    // The first look whose facade hangs a shop board.
    const shop = Array.from({ length: 64 }, (_, look) =>
      building(box(100, 0, 110, 10), 12, "commercial", {
        look,
        shopfront: true,
      }),
    ).find((v) => {
      const f = cityFrames([v])[0]!.frame;
      return f.walls.some((x) => shopBoardOn(f, x) !== null);
    })!;
    const f = cityFrames([shop])[0]!.frame;
    const w = f.walls.find((x) => shopBoardOn(f, x) !== null)!;
    const band = f.b.base + f.ground - 0.45 - shopBoardHeight(w) / 2;
    const item = {
      ...on(w, "graffiti", 0, graffiti(1, 0.4, band - 0.2)),
      x: (w.a.x + w.b.x) / 2,
      z: (w.a.z + w.b.z) / 2,
    };
    expect(run([item], { views: [...VIEWS, shop] })["decal-on-sign"]).toBe(1);
    expect(
      run([{ ...item, variant: graffiti(1, 0.4, band - 0.5) }], {
        views: [...VIEWS, shop],
      })["decal-on-sign"],
    ).toBe(0);
  });

  it("finds a wall decal by a passage, or on a building with the game's doorways", () => {
    only("decal-in-passage", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], { passages: [{ from: { x: 4, z: -3 }, to: { x: 4, z: 3 }, width: 2 }] });
    const gate = building(box(0, 0, 10, 6), 3, "garage", {
      doorways: [{ at: { x: 0, z: -3 }, width: 2, bottom: 0, top: 2.5 }],
    });
    only("decal-in-passage", [on(GARAGE_S, "graffiti", 3, graffiti(2, 1, 0.3))], { views: [gate, ...VIEWS.slice(1)] });
  });

  const lamp: StreetPropItem = {
    prop: "lamp-road",
    x: 30,
    y: 0,
    z: -8,
    yaw: 0.5,
    variant: 0,
  };
  const sticker = (patch: Partial<Parameters<typeof stickerVariant>[0]> = {}, item: Partial<StreetPropItem> = {}): StreetPropItem => ({
    prop: "sticker",
    x: lamp.x,
    y: 0,
    z: lamp.z,
    yaw: lamp.yaw,
    variant: stickerVariant({
      design: 2,
      host: 1,
      face: 3,
      lift: 1.5,
      ...patch,
    }),
    ...item,
  });

  it("finds a sticker off its host, by every way of being off it", () => {
    none([lamp, sticker()]);
    only("decal-floating", [sticker()]);
    const off = (items: StreetPropItem[], patch: Partial<DecalWorld> = {}) => expect(run(items, patch)["decal-floating"]).toBe(1);
    off([lamp, sticker({}, { x: lamp.x + 0.05 })]);
    off([lamp, sticker({}, { yaw: lamp.yaw + 0.1 })]);
    off([lamp, sticker({ host: 0 })]);
    off([lamp, sticker()], { poleLamp: () => true });
    off([{ ...lamp, prop: "lamp-modern-pole" }, sticker({ host: 0, face: 2 })]);
    off([lamp, sticker({ lift: 2.5 })]);
    off([lamp, sticker({ lift: 0.5 })]);
  });

  const grate = (x: number, z: number, yaw: number, slope: { slopeX?: number; slopeZ?: number } = {}): StreetPropItem => ({
    prop: "drain-grate",
    x,
    y: 0,
    z,
    yaw,
    variant: grateVariant({ casting: 0, slopeX: 0, slopeZ: 0, ...slope }),
  });
  // Facing +z (yaw 0) towards the kerb at z -13: its middle 0.08 + 0.15 m short of it.
  const atKerb = (x: number) => grate(x, -13 - 0.23, 0);

  it("finds a grate off the road's fall, off the carriageway, short of its kerb or on a crossing", () => {
    none([atKerb(20)]);
    // On the fall its variant says (local x is world x at yaw 0): none; off it: found.
    none([grate(20, -13.23, 0, { slopeX: 0.1 })], {
      groundY: (x) => (x - 20) * 0.1,
    });
    only("decal-floating", [atKerb(20)], { groundY: (x) => (x - 20) * 0.1 });
    only("decal-floating", [{ ...atKerb(20), y: 0.05 }]);
    // A hump under its middle alone: the corners on the plane, the grate sunk into it.
    only("decal-floating", [atKerb(20)], {
      groundY: (x, z) => (Math.hypot(x - 20, z + 13.23) < 0.1 ? 0.05 : 0),
    });
    only("decal-off-kerb", [grate(20, -13.05, 0)]);
    only("decal-off-kerb", [grate(20, -16, 0)]);
    only("decal-off-kerb", [grate(-0.1, -16, Math.PI / 2)]);
    only("decal-on-crossing", [atKerb(51)]);
  });
});
