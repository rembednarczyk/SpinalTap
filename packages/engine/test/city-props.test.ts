// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import type { BlockSkin } from "@seki/core";
import { describe, expect, it } from "vitest";
import { GeometrySink, parseCityKit, planSkin } from "../src/renderer/city-kit-data";
import { LITE, addPropToKit, addPropToSink, facing, kitUvs, onWall, parseCityProps, pickProp, transformProp, triangleCount } from "../src/renderer/city-props";
import { planKitProps } from "../src/renderer/kit-props";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type FacadeFrame, type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { AWNING_GAP, AWNING_HEADROOM, AWNING_UNDER_TOP, type Obstacle, type ObstacleQuery, type PropSlot, bakeSlots, placeSlot, planFacadeExtras, wallRectHits } from "../src/renderer/mapcity/facade-props";
import { shopBoardOn } from "../src/renderer/mapcity/sign-plan";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { planNearVertical } from "../src/renderer/mapcity/vertical-plan";
import { planWallClutter } from "../src/renderer/mapcity/wall-clutter";

/** Facade props from CC0 packs (ADR-0058): the file, the transforms and where they stand. */

const read = (name: string): ArrayBuffer => {
  const f = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
};
const propsFile = read("city-props.glb");
const props = parseCityProps(propsFile);
const kit = parseCityKit(read("city-kit.glb"));

const bounds = (p: Float32Array) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    min[i % 3] = Math.min(min[i % 3]!, p[i]!);
    max[i % 3] = Math.max(max[i % 3]!, p[i]!);
  }
  return { min, max };
};

/** Does every triangle still wind the way its stored normals face (no mirror in the transform)? */
const windsWithNormals = (positions: Float32Array | number[], normals: Float32Array | number[], indices: Iterable<number>): number => {
  let agree = 0;
  let total = 0;
  const ix = [...indices];
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t]!, ix[t + 1]!, ix[t + 2]!];
    const P = (i: number, k: number) => positions[i * 3 + k]!;
    const e1 = [P(b, 0) - P(a, 0), P(b, 1) - P(a, 1), P(b, 2) - P(a, 2)];
    const e2 = [P(c, 0) - P(a, 0), P(c, 1) - P(a, 1), P(c, 2) - P(a, 2)];
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    if (Math.hypot(n[0]!, n[1]!, n[2]!) < 1e-9) continue;
    const s = [0, 1, 2].reduce((acc, k) => acc + n[k]! * (normals[a * 3 + k]! + normals[b * 3 + k]! + normals[c * 3 + k]!), 0);
    total++;
    if (s < 0) agree++;
  }
  return agree / Math.max(total, 1);
};

describe("city-props.glb (ADR-0058)", () => {
  it("holds the facade props: keys pr-*, metres, at most 1.5 thousand triangles each, a small file", () => {
    expect(propsFile.byteLength).toBeLessThan(512 * 1024);
    expect(props.models.size).toBeGreaterThanOrEqual(10);
    for (const m of props.models.values()) {
      expect(m.key).toMatch(/^pr-[a-z0-9-]+$/);
      expect(triangleCount(m)).toBeLessThanOrEqual(1500);
      expect(m.size.x).toBeGreaterThan(0.05);
      expect(Math.max(m.size.x, m.size.y, m.size.z)).toBeLessThan(5);
      expect(m.styles.length).toBeGreaterThan(0);
      for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
    }
    // Nothing of a facade prop is self-lit (pr-ac-stack's label strip is paint, not neon).
    for (const m of props.models.values()) {
      for (let i = 0; i < m.uvs.length; i += 2) {
        const k = Math.min(props.grid - 1, Math.floor(m.uvs[i]! * props.grid)) + props.grid * Math.min(props.grid - 1, Math.floor(m.uvs[i + 1]! * props.grid));
        expect(props.swatches[k]!.kind, m.key).not.toBe("glow");
      }
    }
    for (const style of ["ac-wall", "ac-roof", "ac-firewall", "antenna", "dish", "pipe", "pipe-corner", "awning", "awning-flat"]) expect(props.byStyle.get(style)?.length ?? 0).toBeGreaterThan(0);
    // The phone's cheap air conditioners.
    expect(pickProp(props, "ac-wall", 1, true)?.styles).toContain(LITE);
    expect(pickProp(props, "ac-wall", 1, false)?.styles).not.toContain(LITE);
  });

  it("shares the city kit's palette: every swatch of the props is a kit swatch, the awnings in cloth", () => {
    const names = new Set(kit.swatches.map((s) => s.name));
    for (const s of props.swatches) expect(names.has(s.name)).toBe(true);
    for (const role of ["fabric-teal", "fabric-magenta", "fabric-amber", "plant"]) expect(names.has(role)).toBe(true);
    const awning = props.models.get("pr-awning-wide-magenta")!;
    const sink = new MeshSink();
    addPropToSink(sink, props, awning, facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 1, z: 1 }));
    // #8e2457, painted (alpha 1).
    expect(sink.colors.slice(0, 4).map((c) => Math.round(c * 255))).toEqual([0x8e, 0x24, 0x57, 255]);
  });
});

describe("prop transforms (ADR-0058)", () => {
  const ac = props.models.get("pr-ac-box")!;

  it("hang a model on a wall: the back on the wall, the body out in front, the winding kept", () => {
    for (const out of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: -0.6, y: 0, z: 0.8 }]) {
      const xf = onWall(ac, { x: 5, y: 2, z: -3 }, out, { x: 1.2, y: 1.2, z: 1.2 });
      const { positions, normals } = transformProp(ac, xf);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const d = (positions[i]! - 5) * out.x + (positions[i + 2]! + 3) * out.z;
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      expect(lo).toBeCloseTo(0, 3);
      expect(hi).toBeCloseTo(ac.size.z * 1.2, 2);
      expect(bounds(positions).min[1]).toBeCloseTo(2, 3);
      expect(windsWithNormals(positions, normals, ac.indices)).toBeCloseTo(windsWithNormals(ac.positions, ac.normals, ac.indices), 2);
    }
  });

  it("turn a pipe run upright without mirroring it", () => {
    const pipe = props.models.get("pr-pipe")!;
    const { positions, normals } = transformProp(pipe, facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 2, y: 1, z: 1 }, true));
    const b = bounds(positions);
    expect(b.max[1]! - b.min[1]!).toBeCloseTo(pipe.size.x * 2, 2);
    expect(windsWithNormals(positions, normals, pipe.indices)).toBeCloseTo(windsWithNormals(pipe.positions, pipe.normals, pipe.indices), 2);
  });

  it("bake into a kit cell on the kit's texture and into a map cell with colours", () => {
    const kitSink = new GeometrySink();
    addPropToKit(kitSink, props, kitUvs(props, kit), ac, facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }));
    expect(kitSink.vertexCount).toBe(ac.positions.length / 3);
    expect(kitSink.uvs.length / 2).toBe(kitSink.vertexCount);
    // Kit UVs lie in the palette rows (the top third of the kit texture).
    for (let i = 1; i < kitSink.uvs.length; i += 2) expect(kitSink.uvs[i]!).toBeLessThan(1 / 3);
    const mapSink = new MeshSink();
    addPropToSink(mapSink, props, ac, facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }));
    expect(mapSink.colors.length / 4).toBe(mapSink.vertexCount);
    expect(mapSink.uvs2.length / 2).toBe(mapSink.vertexCount);
    expect(mapSink.indices.length).toBe(ac.indices.length);
  });
});

const block = (style: BlockSkin["style"]): { skin: BlockSkin; size: { x: number; y: number; z: number }; center: { x: number; y: number; z: number } } => ({
  skin: { style, front: "z-", street: 8 },
  size: { x: 16, y: 13, z: 10 },
  center: { x: 40.5, y: 6.5, z: -12 },
});

describe("props on the city kit's blocks (ADR-0058)", () => {
  it("replace every procedural AC box in its spot and keep the rest of the plan", () => {
    let seen = 0;
    for (let k = 0; k < 12; k++) {
      const b = block("tenement");
      const center = { ...b.center, x: b.center.x + k * 23 };
      const plan = planSkin(kit, b.skin, b.size, center)!;
      const units = plan.decor.filter((d) => d.kind === "box" && d.swatch === "ac");
      const { decor, props: placed } = planKitProps(props, plan, b.skin, b.size);
      expect(decor.some((d) => d.kind === "box" && (d.swatch === "ac" || d.swatch === "ac-grille"))).toBe(false);
      expect(decor.length).toBe(plan.decor.length - units.length * 2);
      const acs = placed.filter((p) => p.model.styles.includes("ac-wall"));
      expect(acs.length).toBe(units.length);
      seen += acs.length;
      // The same block always gets the same props.
      expect(planKitProps(props, planSkin(kit, b.skin, b.size, center)!, b.skin, b.size).props.map((p) => p.model.key)).toEqual(placed.map((p) => p.model.key));
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("put nothing on a walked roof, only cheap units on a phone and nothing on vehicles", () => {
    for (let k = 0; k < 20; k++) {
      const b = block("tenement");
      const center = { ...b.center, z: b.center.z + k * 17 };
      const plan = planSkin(kit, b.skin, b.size, center)!;
      const walked = planKitProps(props, plan, b.skin, b.size, { walkedRoof: true }).props;
      expect(walked.some((p) => p.model.styles.includes("antenna"))).toBe(false);
      for (const p of planKitProps(props, plan, b.skin, b.size, { lite: true }).props) expect(p.model.styles).toContain(LITE);
    }
    const car = block("car");
    const plan = planSkin(kit, car.skin, { x: 2, y: 1.5, z: 4.5 }, car.center)!;
    expect(planKitProps(props, plan, car.skin, { x: 2, y: 1.5, z: 4.5 }).props).toEqual([]);
  });
});

const rect = (x0: number, z0: number, x1: number, z1: number) => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
const building = (extra: Partial<MapBuilding> = {}): MapBuilding => ({ id: 3, ring: rect(0, 0, 24, 14), base: 0, foot: 0, height: 13, levels: 4, use: "residential", look: 0x2077, rise: 15, clutter: 0.8, shopfront: true, ...extra });
const none = () => null;

describe("props on the map city's facades (ADR-0058)", () => {
  it("take the slots of the wall clutter and the rooftop gear without changing their random draws", () => {
    const f = facadeFrame(building(), none);
    const plain = new MeshSink();
    planWallClutter(plain, f);
    planNearVertical(plain, f);
    const declined = new MeshSink();
    planWallClutter(declined, f, () => false);
    planNearVertical(declined, f, () => false);
    expect(declined.positions).toEqual(plain.positions);
    const slots: PropSlot[] = [];
    const taken = new MeshSink();
    planWallClutter(taken, f, (s) => slots.push(s) > 0);
    planNearVertical(taken, f, (s) => slots.push(s) > 0);
    expect(taken.vertexCount).toBeLessThan(plain.vertexCount);
    const kinds = new Set(slots.map((s) => s.kind));
    for (const k of ["ac-wall", "dish-roof", "antenna", "pipe-corner"] as const) expect(kinds.has(k)).toBe(true);
  });

  const extras = (b: MapBuilding, obstacles?: ObstacleQuery) => {
    const out: PropSlot[] = [];
    planFacadeExtras(facadeFrame(b, none), (s) => out.push(s) > 0, obstacles);
    return out;
  };
  // Tall enough a ground floor for awnings under the biggest boards (1.3 m).
  const shop = (extra: Partial<MapBuilding> = {}) => building({ height: 16, ...extra });
  /** The street wall a slot hangs on. */
  const wallOf = (f: FacadeFrame, s: PropSlot) =>
    f.walls.find((w) => Math.abs((s.at.x - w.a.x) * w.nx + (s.at.z - w.a.z) * w.nz) < 1e-6 && Math.abs(w.nx - s.out.x) < 1e-9 && Math.abs(w.nz - s.out.z) < 1e-9)!;

  it("hang dishes and awnings by the clutter, none in the Old Town or on buildings of the game", () => {
    const busy = extras(shop());
    expect(busy.some((s) => s.kind === "awning")).toBe(true);
    expect(busy.some((s) => s.kind === "dish")).toBe(true);
    expect(extras(shop())).toEqual(busy);
    expect(extras(shop({ clutter: 0.25 }))).toEqual([]);
    expect(extras(shop({ doorways: [{ x: 12, z: 0, width: 1.2, bottom: 0, top: 2.4 }] }))).toEqual([]);
  });

  it("hang awnings under the bottom of the shop board, boards up to 1.3 m tall, with 2 m of headroom", () => {
    let checked = 0;
    const heights = new Set<number>();
    for (const [w, d, h] of [[24, 14, 16], [9, 7, 16], [5, 12, 15], [30, 10, 18], [24, 14, 13]] as const) {
      for (const look of [0x2077, 0x1234, 0xbeef, 0x51]) {
        const f = facadeFrame(shop({ ring: rect(0, 0, w, d), height: h, look }), none);
        for (const s of extras(f.b).filter((x) => x.kind === "awning" || x.kind === "awning-flat")) {
          const wall = wallOf(f, s);
          const board = shopBoardOn(f, wall);
          if (board !== null) heights.add(board);
          // Under the board's bottom, or under the ground floor's top on a wall without a board.
          const boardBottom = board === null ? f.b.base + f.ground - AWNING_UNDER_TOP + AWNING_GAP : f.b.base + f.ground - 0.45 - board / 2;
          for (const p of placeSlot(props, s, false)) {
            const ys = [...transformProp(p.model, p.xf).positions].filter((_, i) => i % 3 === 1);
            expect(Math.max(...ys)).toBeLessThanOrEqual(boardBottom - AWNING_GAP + 1e-3);
            expect(Math.min(...ys)).toBeGreaterThanOrEqual(f.b.base + AWNING_HEADROOM - 1e-3);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(Math.max(...heights)).toBe(1.3);
    expect(Math.min(...heights)).toBeLessThan(1.3);
  });

  it("leave an awning out where a parasol, a shelter or a tree stands by the wall", () => {
    const f = facadeFrame(shop(), none);
    const free = extras(f.b).filter((s) => s.kind === "awning");
    expect(free.length).toBeGreaterThan(0);
    // A café garden's parasol (radius 2 m) 1.5 m out from the first awning's middle.
    const a = free[0]!;
    const parasol: Obstacle = { x: a.at.x + a.out.x * 1.5, z: a.at.z + a.out.z * 1.5, r: 2 };
    const query: ObstacleQuery = (x, z, r) => (Math.hypot(parasol.x - x, parasol.z - z) < r + parasol.r ? [parasol] : []);
    const crowded = extras(f.b, query).filter((s) => s.kind === "awning");
    expect(crowded.length).toBeLessThan(free.length);
    for (const s of crowded) {
      const w = wallOf(f, s);
      const u = (s.at.x - w.a.x) * ((w.b.x - w.a.x) / w.length) + (s.at.z - w.a.z) * ((w.b.z - w.a.z) / w.length);
      expect(wallRectHits(w, u - s.width! / 2, u + s.width! / 2, 1, [parasol])).toBe(false);
    }
    // Far furniture changes nothing.
    expect(extras(f.b, () => [{ x: 500, z: 500, r: 2 }]).filter((s) => s.kind === "awning")).toEqual(free);
  });

  it("hang one dish per pier and storey", () => {
    for (const look of [0x2077, 0x1234, 0xbeef, 0x51, 0x777]) {
      const dishes = extras(shop({ look, ring: rect(0, 0, 40, 14) })).filter((s) => s.kind === "dish");
      const keys = dishes.map((s) => `${s.at.x.toFixed(3)}:${s.at.y.toFixed(3)}:${s.at.z.toFixed(3)}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("bake a pipe run in segments along the wall, and only air conditioners on a phone", () => {
    const run: PropSlot = { kind: "pipe", at: { x: 0, y: 5, z: 0 }, out: { x: 0, y: 0, z: -1 }, width: 9 };
    const parts = placeSlot(props, run, false);
    expect(parts.length).toBe(3);
    const xs = parts.flatMap((p) => [...transformProp(p.model, p.xf).positions].filter((_, i) => i % 3 === 0));
    expect(Math.min(...xs)).toBeCloseTo(-4.5, 1);
    expect(Math.max(...xs)).toBeCloseTo(4.5, 1);
    const full = new MeshSink();
    const lite = new MeshSink();
    const slots: PropSlot[] = [run, { kind: "dish", at: { x: 0, y: 8, z: 0 }, out: { x: 0, y: 0, z: -1 } }, { kind: "ac-wall", at: { x: 2, y: 8, z: 0 }, out: { x: 0, y: 0, z: -1 } }];
    bakeSlots(full, props, slots, false);
    bakeSlots(lite, props, slots, true);
    expect(lite.vertexCount).toBeGreaterThan(0);
    expect(lite.vertexCount).toBeLessThan(full.vertexCount / 4);
  });
});

