import { describe, expect, it } from "vitest";
import { DRAIN_GRATE, HOUSE_PLATE, STICKER_HOSTS, grateLayout, graffitiLayout, hostFaces, plateLayout, stickerLayout } from "../../../packages/core/src/world/decals.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type DecalContext, type DecalWall, END_ROOM, MURAL_LIFT, PLATE_LIFT, STREET_LIFT, addDecals } from "../src/props-decals.ts";
import { GRATE_SPACING, KERB_GAP, STICKER_GAP, grateCorners } from "../src/props-decals-street.ts";
import { Site } from "../src/props-site.ts";
import type { Tags } from "../src/osm.ts";

/**
 * The rules of the decals (ADR-0058 stage 6) on a map of their own: a street along z = 30 with its
 * carriageway (z 26..34), sidewalks on both sides and a zebra at x 60..64; a row of walls north of it
 * at z = 40 facing the street, each a building of its own; the furniture's road lamps on the
 * sidewalk. Every rule is shown on its own wall, and its exceptions with it.
 */

type Pt = { readonly x: number; readonly z: number };

const chunk = (district: LublinChunkData["district"], heights = [0, 0, 0, 0, 0, 0]): LublinChunkData => ({
  id: "t-0-0",
  district,
  bounds: { minX: 0, maxX: 300, minZ: 0, maxZ: 60 },
  terrain: { originX: 0, originZ: 0, cell: 150, cols: 3, rows: 2, heights },
  buildings: [
    {
      id: "w1",
      x: 150,
      z: 45,
      y: 0,
      outline: [-150, -5, 150, -5, 150, 5, -150, 5],
      parts: [],
      height: 3,
      plinth: 0,
      levels: 1,
      use: "garage",
      look: 1,
      source: "default",
    },
  ],
  ground: [
    { surface: "sidewalk", outline: [0, 22, 300, 22, 300, 26, 0, 26] },
    { surface: "sidewalk", outline: [0, 34, 300, 34, 300, 38, 0, 38] },
    { surface: "road", outline: [0, 26, 300, 26, 300, 34, 0, 34] },
    { surface: "crossing", outline: [60, 26, 64, 26, 64, 34, 60, 34] },
  ],
  streets: [{ name: "Testowa", kind: "residential", line: [0, 30, 300, 30] }],
  markings: [],
  pois: [],
});

/** A wall from (x0, 40) to (x0 + length, 40) facing the street (-z): a building of its own. */
const wall = (x0: number, patch: Partial<DecalWall> = {}): DecalWall => ({
  building: `b${x0}`,
  osm: `w${x0}`,
  district: "targ",
  use: "garage",
  landmark: false,
  a: { x: x0, z: 40 },
  b: { x: x0 + 8, z: 40 },
  nx: 0,
  nz: -1,
  length: 8,
  base: 0,
  top: 3,
  from: 0,
  blind: false,
  glassFree: true,
  holo: false,
  passages: false,
  neighbourTop: () => null,
  boards: [],
  ...patch,
});

/** Thirty walls side by side, each 8 m long with 2 m between them. */
const row = (patch: Partial<DecalWall> = {}): DecalWall[] => Array.from({ length: 30 }, (_, k) => wall(k * 10, patch));

const ctx = (patch: Partial<DecalContext> = {}): DecalContext => ({
  groundY: () => 0,
  ...patch,
});

const decals = (walls: readonly DecalWall[], c: Partial<DecalContext> = {}, district: LublinChunkData["district"] = "targ", furniture: StreetPropItem[] = [], heights?: number[]) => {
  const site = new Site([chunk(district, heights)]);
  const byChunk = new Map<string, StreetPropItem[]>([["t-0-0", [...furniture]]]);
  const out = addDecals(byChunk, site, walls, ctx(c));
  const items = byChunk.get("t-0-0")!.filter((i) => !furniture.includes(i));
  return {
    items,
    of: (prop: string) => items.filter((i) => i.prop === prop),
    out,
  };
};

/** The wall a wall decal stands on: its foot on the face, facing out, its span inside the ends. */
const onItsWall = (i: StreetPropItem, walls: readonly DecalWall[], width: number): DecalWall => {
  const w = walls.find((x) => Math.abs(i.z - x.a.z) < 0.01 && i.x >= x.a.x - 1e-6 && i.x <= x.b.x + 1e-6)!;
  expect(w, `${i.prop} at ${i.x},${i.z}`).toBeDefined();
  expect(Math.abs(Math.cos(i.yaw) - w.nz)).toBeLessThan(1e-3);
  expect(i.x - width / 2).toBeGreaterThanOrEqual(w.a.x + END_ROOM - 0.02);
  expect(i.x + width / 2).toBeLessThanOrEqual(w.b.x - END_ROOM + 0.02);
  return w;
};

describe("graffiti (ADR-0058 stage 6)", () => {
  it("paints walls without glass at street level in a district that takes it, flat on the face, over the pavement, under the top", () => {
    const walls = row();
    const g = decals(walls).of("graffiti");
    expect(g.length).toBeGreaterThan(15);
    for (const i of g) {
      const l = graffitiLayout(i.variant);
      const w = onItsWall(i, walls, l.width);
      expect(i.y + l.lift).toBeGreaterThanOrEqual(STREET_LIFT - 1e-6);
      expect(i.y + l.lift + l.height).toBeLessThanOrEqual(w.top - 0.3 + 1e-6);
    }
    // The same map, the same paint.
    expect(decals(row()).of("graffiti")).toEqual(g);
  });

  it("paints less on the deptak and nothing in the Old Town, by the district the piece is in", () => {
    const targ = decals(row()).of("graffiti").length;
    const deptak = decals(row({ district: "shinsekai-7" }), {}, "shinsekai-7").of("graffiti").length;
    expect(deptak).toBeLessThan(targ);
    expect(deptak).toBeGreaterThan(0);
    expect(decals(row({ district: "kanal" }), {}, "kanal").of("graffiti")).toHaveLength(0);
    // A building of the market reaching into the Old Town: its pieces there stay out.
    expect(decals(row(), {}, "kanal").of("graffiti")).toHaveLength(0);
  });

  it("spares landmarks, buildings of historic, sacred or civic use and those the map tags historic or heritage", () => {
    for (const patch of [{ landmark: true }, { use: "historic" }, { use: "church" }, { use: "civic" }]) expect(decals(row(patch)).of("graffiti"), JSON.stringify(patch)).toHaveLength(0);
    for (const t of [{ historic: "building" }, { heritage: "2" }] as Tags[]) {
      const tags = new Map<string, Tags>(row().map((w): [string, Tags] => [w.osm, t]));
      expect(decals(row(), { buildingTags: tags }).of("graffiti"), JSON.stringify(t)).toHaveLength(0);
    }
  });

  it("goes on a glazed wall only in its plinth, under its ground floor, where the plinth is tall enough", () => {
    expect(decals(row({ glassFree: false })).of("graffiti")).toHaveLength(0);
    expect(decals(row({ glassFree: false, base: 0.8 })).of("graffiti")).toHaveLength(0);
    const g = decals(row({ glassFree: false, base: 1.6 })).of("graffiti");
    expect(g.length).toBeGreaterThan(5);
    for (const i of g) {
      const l = graffitiLayout(i.variant);
      expect(i.y + l.lift + l.height).toBeLessThanOrEqual(1.6 - 0.06 + 1e-6);
      expect(i.y + l.lift).toBeGreaterThanOrEqual(0.12 - 1e-6);
    }
  });

  it("paints a firewall over its neighbour as a mural, never where a holo-ad may hang", () => {
    const fire = row({ blind: true, from: 6, top: 16 });
    const g = decals(fire).of("graffiti");
    expect(g.length).toBeGreaterThan(5);
    for (const i of g) {
      const l = graffitiLayout(i.variant);
      expect(i.y + l.lift).toBeGreaterThanOrEqual(6 + MURAL_LIFT - 1e-6);
      expect(l.width).toBeGreaterThanOrEqual(2.5);
    }
    expect(decals(row({ blind: true, from: 6, top: 16, holo: true })).of("graffiti")).toHaveLength(0);
    // A firewall the shader glazes (none is: a party wall has no bays) takes none either.
    expect(decals(row({ blind: true, from: 6, top: 16, glassFree: false })).of("graffiti")).toHaveLength(0);
  });

  it("paints nothing on a wall too low for a piece over the pavement", () => {
    expect(decals(row({ top: 0.7 })).of("graffiti")).toHaveLength(0);
    expect(decals(row({ top: 1.2 })).of("graffiti").length).toBeGreaterThan(15);
  });

  it("keeps out of taller neighbours, the venues' boards, the passages and an open front's lack", () => {
    expect(decals(row({ neighbourTop: () => 2.5 })).of("graffiti")).toHaveLength(0);
    // A neighbour lower than its bottom is no obstacle.
    expect(decals(row({ neighbourTop: () => 0.2 })).of("graffiti").length).toBeGreaterThan(15);
    expect(decals(row({ boards: [{ u0: 0, u1: 8, bottom: 0.2, top: 2.5 }] })).of("graffiti")).toHaveLength(0);
    expect(decals(row({ passages: true })).of("graffiti")).toHaveLength(0);
    // The walls turned to face into the garages' row: no open ground in front.
    const inward = row().map((w) => ({
      ...w,
      a: { x: w.a.x, z: 41 },
      b: { x: w.b.x, z: 41 },
    }));
    expect(decals(inward).of("graffiti")).toHaveLength(0);
  });

  it("stands its bottom over the paving under both its ends", () => {
    // The paving rising 2 m along every wall: the bottom over its higher end.
    const g = decals(row(), { surfaceY: (p: Pt) => (p.x % 10) * 0.25 }).of("graffiti");
    for (const i of g) {
      const l = graffitiLayout(i.variant);
      const high = ((i.x + l.width / 2) % 10) * 0.25;
      expect(i.y + l.lift).toBeGreaterThanOrEqual(high + 0.05 - 1e-6);
    }
  });
});

describe("decals in the renderer's furniture blocks", () => {
  it("go only into a block the furniture already fills: a block of decals alone would be a mesh more", () => {
    // Blocks of 100 m along x: a bench in the first only.
    const blockOf = (p: Pt) => String(Math.floor(p.x / 100));
    const bench: StreetPropItem = { prop: "bench", x: 50, y: 0, z: 24, yaw: 0, variant: 0 };
    const { items, out } = decals(row(), { blockOf }, "targ", [bench]);
    expect(items.length).toBeGreaterThan(10);
    for (const i of items) expect(blockOf(i), `${i.prop} at ${i.x}`).toBe("0");
    expect(out.rejected["graffiti block"]).toBeGreaterThan(0);
    expect(out.rejected["drain-grate block"]).toBeGreaterThan(0);
  });
});

describe("house number plates", () => {
  it("puts the map's number on the building's street wall without glass, the plate over the pavement", () => {
    const walls = [wall(0)];
    const p = decals(walls, {
      buildingTags: new Map([["w0", { "addr:housenumber": "12a" }]]),
    }).of("house-plate");
    expect(p).toHaveLength(1);
    const l = plateLayout(p[0]!.variant);
    expect([l.number, l.letter]).toEqual([12, 1]);
    expect(p[0]!.y + l.lift).toBeCloseTo(PLATE_LIFT, 1);
    onItsWall(p[0]!, walls, HOUSE_PLATE.width);
  });

  it("puts none without a number, on a glazed wall, a landmark or a wall facing no street; on the old town's houses it does", () => {
    const tags = new Map([["w0", { "addr:housenumber": "7" }]]);
    expect(decals([wall(0)], {}).of("house-plate")).toHaveLength(0);
    expect(
      decals([wall(0)], {
        buildingTags: new Map([["w0", { "addr:housenumber": "bez numeru" }]]),
      }).of("house-plate"),
    ).toHaveLength(0);
    expect(decals([wall(0, { glassFree: false })], { buildingTags: tags }).of("house-plate")).toHaveLength(0);
    expect(decals([wall(0, { landmark: true })], { buildingTags: tags }).of("house-plate")).toHaveLength(0);
    const back = wall(0, { a: { x: 8, z: 50 }, b: { x: 0, z: 50 }, nz: 1 });
    expect(decals([back], { buildingTags: tags }).of("house-plate")).toHaveLength(0);
    expect(decals([wall(0, { district: "kanal", use: "historic" })], { buildingTags: tags }, "kanal").of("house-plate")).toHaveLength(1);
  });
});

describe("stickers", () => {
  const lamps = Array.from(
    { length: 40 },
    (_, k): StreetPropItem => ({
      prop: "lamp-road",
      x: 2 + k * 7,
      y: 0,
      z: 24,
      yaw: 0.3,
      variant: 0,
    }),
  );
  // Modern lamps' square shafts take three faces only: two stickers meet on a face often.
  const modern = Array.from(
    { length: 140 },
    (_, k): StreetPropItem => ({
      prop: "lamp-modern-pole",
      x: 1 + k * 2,
      y: 0,
      z: 37,
      yaw: -0.2,
      variant: 0,
    }),
  );

  it("sticks them on the hosts' faces at their heights, at their feet with their yaw, apart on one face", () => {
    const hosts = [...lamps, ...modern];
    const s = decals([], {}, "targ", hosts).of("sticker");
    expect(s.length).toBeGreaterThan(100);
    for (const i of s) {
      const l = stickerLayout(i.variant);
      const h = STICKER_HOSTS[l.host]!;
      expect(hosts.some((p) => p.prop === h.kind && p.x === i.x && p.z === i.z && p.yaw === i.yaw)).toBe(true);
      expect(hostFaces(h)).toContain(l.face);
      expect(l.lift).toBeGreaterThanOrEqual(h.low - 1e-6);
      expect(l.lift).toBeLessThanOrEqual(h.high + 1e-6);
      for (const o of s) {
        if (o === i || o.x !== i.x || o.z !== i.z) continue;
        const m = stickerLayout(o.variant);
        if (m.face === l.face) expect(Math.abs(m.lift - l.lift)).toBeGreaterThanOrEqual(STICKER_GAP - 1e-6);
      }
    }
  });

  it("sticks fewer in the Old Town, none on a lamp drawn as a utility pole nor on a pole of another kind", () => {
    expect(decals([], {}, "kanal", lamps).of("sticker").length).toBeLessThan(decals([], {}, "targ", lamps).of("sticker").length / 2);
    expect(decals([], { poleLamp: () => true }, "targ", lamps).of("sticker")).toHaveLength(0);
    expect(
      decals(
        [],
        {},
        "targ",
        lamps.map((l) => ({ ...l, prop: "lamp-pastoral" })),
      ).of("sticker"),
    ).toHaveLength(0);
  });
});

describe("gully grates", () => {
  it("lays them in the carriageway at both kerbs, apart, off the zebra and its band", () => {
    const g = decals([]).of("drain-grate");
    expect(g.length).toBeGreaterThan(10);
    for (const i of g) {
      const kerb = i.z < 30 ? 26 : 34;
      // Facing the kerb, its kerb side `KERB_GAP` short of it.
      expect(Math.abs(Math.cos(i.yaw) - (i.z < 30 ? -1 : 1))).toBeLessThan(1e-3);
      expect(Math.abs(Math.abs(i.z - kerb) - (KERB_GAP + DRAIN_GRATE.width / 2))).toBeLessThan(0.06);
      expect(i.x < 60 - 0.5 - DRAIN_GRATE.length / 2 || i.x > 64 + 0.5 + DRAIN_GRATE.length / 2, `${i.x}`).toBe(true);
      for (const o of g) if (o !== i) expect(Math.hypot(o.x - i.x, o.z - i.z)).toBeGreaterThanOrEqual(GRATE_SPACING - 1e-6);
    }
    expect(g.some((i) => i.z < 30)).toBe(true);
    expect(g.some((i) => i.z > 30)).toBe(true);
    // Before and after the zebra, on both kerbs.
    for (const side of [-1, 1])
      for (const z of [26, 34])
        expect(
          g.some((i) => Math.abs(i.x - (62 + side * 3.7)) < 1 && Math.abs(i.z - z) < 0.5),
          `${side} ${z}`,
        ).toBe(true);
  });

  it("keeps off a manhole and records the road's fall under it, none on a road steeper than the casting takes", () => {
    const base = decals([]).of("drain-grate");
    const hole: StreetPropItem = {
      prop: "manhole",
      x: base[0]!.x,
      y: 0,
      z: base[0]!.z,
      yaw: 0,
      variant: 0,
    };
    expect(
      decals([], {}, "targ", [hole])
        .of("drain-grate")
        .some((i) => Math.hypot(i.x - hole.x, i.z - hole.z) < 0.8),
    ).toBe(false);
    // 5 % up along x: the fall along the kerb is in the variant (local x runs along the kerb).
    const tilted = decals([], { groundY: (p: Pt) => p.x * 0.05 }).of("drain-grate");
    expect(tilted.length).toBe(base.length);
    for (const i of tilted) expect(Math.abs(Math.abs(grateLayout(i.variant).slopeX) - 0.05)).toBeLessThan(0.006);
    expect(decals([], { groundY: (p: Pt) => p.x * 0.2 }).of("drain-grate")).toHaveLength(0);
  });

  it("keeps every grate wholly on the carriageway, off the zebras' bands and apart, on a street of kerb extensions and zebras", () => {
    const c = chunk("targ");
    // A kerb extension 0.3 m wide every 2 m on the north side (the sidewalk drawn 0.8 m over the road),
    // and a zebra every 20 m.
    const nubs = Array.from({ length: 150 }, (_, k) => ({
      surface: "sidewalk" as const,
      outline: [k * 2, 33.2, k * 2 + 0.3, 33.2, k * 2 + 0.3, 34, k * 2, 34],
    }));
    const zebras = Array.from({ length: 15 }, (_, k) => ({
      surface: "crossing" as const,
      outline: [k * 20 + 8, 26, k * 20 + 12, 26, k * 20 + 12, 34, k * 20 + 8, 34],
    }));
    const site = new Site([{ ...c, ground: [...c.ground.slice(0, 3), ...nubs, ...zebras] }]);
    const byChunk = new Map<string, StreetPropItem[]>([["t-0-0", []]]);
    addDecals(byChunk, site, [], ctx());
    const g = byChunk.get("t-0-0")!.filter((i) => i.prop === "drain-grate");
    expect(g.length).toBeGreaterThan(10);
    const inBox = (p: Pt, o: readonly number[]) => p.x >= o[0]! && p.x <= o[2]! && p.z >= o[1]! && p.z <= o[5]!;
    for (const i of g) {
      const n = { x: Math.sin(i.yaw), z: Math.cos(i.yaw) };
      const corners = grateCorners(i, n);
      for (const q of corners) {
        expect(q.z > 26 && q.z < 34, `${i.x},${i.z} on the road`).toBe(true);
        expect(
          nubs.some((s) => inBox(q, s.outline)),
          `${i.x},${i.z} under a kerb extension`,
        ).toBe(false);
        // A zebra's band: its outline, 0.5 m past its sides.
        expect(
          zebras.some((s) => q.x > s.outline[0]! - 0.5 && q.x < s.outline[2]! + 0.5),
          `${i.x},${i.z} on a zebra`,
        ).toBe(false);
      }
      for (const o of g) if (o !== i) expect(Math.hypot(o.x - i.x, o.z - i.z), `${i.x},${i.z}`).toBeGreaterThanOrEqual(GRATE_SPACING - 1e-6);
    }
  });

  it("finds the kerb where a sidewalk is drawn over the road's edge", () => {
    const c = chunk("targ");
    // The north sidewalk reaching a metre over the carriageway: its kerb at z = 33.
    const site = new Site([
      {
        ...c,
        ground: [c.ground[0]!, { surface: "sidewalk", outline: [0, 33, 300, 33, 300, 38, 0, 38] }, c.ground[2]!],
      },
    ]);
    const byChunk = new Map<string, StreetPropItem[]>([["t-0-0", []]]);
    addDecals(byChunk, site, [], ctx());
    const north = byChunk.get("t-0-0")!.filter((i) => i.prop === "drain-grate" && i.z > 30);
    expect(north.length).toBeGreaterThan(5);
    for (const i of north) expect(i.z).toBeCloseTo(33 - KERB_GAP - DRAIN_GRATE.width / 2, 1);
  });

  it("lays none beside a road with no ground for a kerb beside it", () => {
    const c = chunk("targ");
    const site = new Site([
      {
        ...c,
        ground: [
          { surface: "road", outline: [0, 26, 300, 26, 300, 34, 0, 34] },
          { surface: "rail", outline: [0, 34, 300, 34, 300, 38, 0, 38] },
          { surface: "water", outline: [0, 20, 300, 20, 300, 26, 0, 26] },
        ],
      },
    ]);
    const byChunk = new Map<string, StreetPropItem[]>([["t-0-0", []]]);
    addDecals(byChunk, site, [], ctx());
    expect(byChunk.get("t-0-0")!.filter((i) => i.prop === "drain-grate")).toHaveLength(0);
  });
});
