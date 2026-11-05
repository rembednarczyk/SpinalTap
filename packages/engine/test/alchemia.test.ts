// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_MODULES, ALCHEMIA_ROOF, type AlchemiaPart, alchemiaParts, alchemiaPoint, type PlacedAlchemiaModule } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { ALCHEMIA_DRAW, AlchemiaView } from "../src/renderer/alchemia/alchemia-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const bytes = file("alchemia-props.glb");
const alchemia = parseCityProps(bytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), alchemia);

type Pt = { readonly x: number; readonly z: number };

/** A point in the module's own frame (glTF x and z) from a world point: the inverse of `alchemiaPoint`. */
const local = (m: PlacedAlchemiaModule, p: Pt): Pt => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  return { x: -dx * fz + dz * fx, z: dx * fx + dz * fz };
};

/** The box of a part's outline in the model's frame: x0, x1, z0, z1. */
const bounds = (p: AlchemiaPart): readonly [number, number, number, number] => {
  const xs = p.points.map((q) => q[0]);
  const zs = p.points.map((q) => q[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};

/** True when a point of the model's frame lies within `pad` of the part's box. */
const near = (p: AlchemiaPart, q: Pt, pad: number): boolean => {
  const [x0, x1, z0, z1] = bounds(p);
  return q.x >= x0 - pad && q.x <= x1 + pad && q.z >= z0 - pad && q.z <= z1 + pad;
};

type Pt3 = { readonly x: number; readonly y: number; readonly z: number };
type Tri = readonly [Pt3, Pt3, Pt3];

/** True when a point of the model's frame lies in the part's (convex) outline. */
const insidePart = (p: AlchemiaPart, x: number, z: number): boolean => {
  let sign = 0;
  for (let i = 0; i < p.points.length; i++) {
    const [ax, az] = p.points[i]!;
    const [bx, bz] = p.points[(i + 1) % p.points.length]!;
    const s = Math.sign((bx - ax) * (z - az) - (bz - az) * (x - ax));
    if (s !== 0 && sign !== 0 && s !== sign) return false;
    if (s !== 0) sign = s;
  }
  return true;
};

/** The world vertices of the module's model in the geometry (they follow its plinth's and its steps' 24 each). */
const modelVertices = (positions: readonly number[], start: number, count: number): { x: number; y: number; z: number }[] =>
  Array.from({ length: count }, (_, i) => ({ x: positions[3 * (start + i)]!, y: positions[3 * (start + i) + 1]!, z: positions[3 * (start + i) + 2]! }));

/** The hall model's triangles in the geometry, in its own frame (y over its floor). */
const hallFaces = (): Tri[] => {
  const { sink } = alchemiaGeometry(kitData, props);
  const hall = ALCHEMIA_MODULES[0]!;
  const from = 24 * (1 + hall.steps.length);
  const to = from + alchemia.models.get(hall.key)!.positions.length / 3;
  const at = (k: number): Pt3 => {
    const w = { x: sink.positions[3 * k]!, y: sink.positions[3 * k + 1]!, z: sink.positions[3 * k + 2]! };
    const q = local(hall, w);
    return { x: q.x, y: w.y - hall.floor, z: q.z };
  };
  const tris: Tri[] = [];
  for (let i = 0; i < sink.indices.length; i += 3) {
    const ids = [sink.indices[i]!, sink.indices[i + 1]!, sink.indices[i + 2]!];
    if (ids.every((k) => k >= from && k < to)) tris.push([at(ids[0]!), at(ids[1]!), at(ids[2]!)]);
  }
  return tris;
};

/** The heights of the faces drawn over a point of the model's frame. */
const facesAt = (tris: readonly Tri[], x: number, z: number): number[] => {
  const hs: number[] = [];
  for (const [a, b, c] of tris) {
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (u < 0 || v < 0 || u + v > 1) continue;
    hs.push(u * a.y + v * b.y + (1 - u - v) * c.y);
  }
  return hs.sort((p, q) => p - q);
};

/** The distance from a point to a segment. */
const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};

/** Where the drawn walls (the faces standing upright) cut the level `y`: segments of the model's frame. */
const wallsAt = (tris: readonly Tri[], y: number): [Pt, Pt][] => {
  const out: [Pt, Pt][] = [];
  for (const t of tris) {
    const [a, b, c] = t;
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    const n = Math.hypot((b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), ny, (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (n < 1e-9 || Math.abs(ny) / n > 0.2) continue;
    const cut: Pt[] = [];
    for (let i = 0; i < 3; i++) {
      const p = t[i]!;
      const q = t[(i + 1) % 3]!;
      if ((p.y - y) * (q.y - y) >= 0) continue;
      const u = (y - p.y) / (q.y - p.y);
      cut.push({ x: p.x + u * (q.x - p.x), z: p.z + u * (q.z - p.z) });
    }
    if (cut.length === 2) out.push([cut[0]!, cut[1]!]);
  }
  return out;
};

describe("alchemia-props.glb (ADR-0063 stage 4)", () => {
  it("holds the hall and five stalls, CC-BY with their credits, within a building's budget each and small", () => {
    expect([...alchemia.models.keys()]).toEqual(ALCHEMIA_MODULES.map((m) => m.key));
    let total = 0;
    for (const m of alchemia.models.values()) {
      expect(triangleCount(m)).toBeLessThanOrEqual(8000);
      total += triangleCount(m);
    }
    expect(total).toBeLessThan(12_000);
    expect(bytes.byteLength).toBeLessThan(640 * 1024);
    expect(alchemia.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(bytes, 20, new DataView(bytes, 12, 4).getUint32(0, true)));
    expect(json.match(/"credit":"sketchfab-cyberpunk-building"/g)).toHaveLength(1);
    expect(json.match(/"credit":"sketchfab-hw4-cyberpunk-building"/g)).toHaveLength(5);
  });

  it("has the sizes the simulation's solids are made of", () => {
    for (const m of ALCHEMIA_MODULES) {
      const s = alchemia.models.get(m.key)!.size;
      expect(s.x, m.key).toBeCloseTo(m.width, 1);
      expect(s.z, m.key).toBeCloseTo(m.depth, 1);
      expect(s.y, m.key).toBeLessThanOrEqual(m.height + 0.01);
    }
    // The height is the tallest model's of its kind: the hall's, the tallest stall's.
    for (const key of ["alchemia-hall", "alchemia-stall"]) {
      const kind = ALCHEMIA_MODULES.filter((m) => m.key.startsWith(key));
      expect(Math.max(...kind.map((m) => alchemia.models.get(m.key)!.size.y))).toBeGreaterThan(kind[0]!.height - 0.05);
    }
  });
});

describe("Alchemia's geometry (ADR-0063 stage 4)", () => {
  it("stands each model on its floor inside its footprint, under its solid's parts, on a plinth; boxes without the file", () => {
    const withFile = alchemiaGeometry(kitData, props);
    const without = alchemiaGeometry(kitData, null);
    expect(withFile.models).toBe(ALCHEMIA_MODULES.length);
    expect(without.models).toBe(0);
    for (const g of [withFile, without]) for (const i of g.sink.indices) expect(i).toBeLessThan(g.sink.vertexCount);
    let at = 0;
    for (const m of ALCHEMIA_MODULES) {
      at += 24 * (1 + m.steps.length); // the plinth and the steps
      const n = alchemia.models.get(m.key)!.positions.length / 3;
      const vs = modelVertices(withFile.sink.positions, at, n);
      at += n;
      const parts = alchemiaParts(m);
      let lowest = Infinity;
      for (const v of vs) {
        const q = local(m, v);
        lowest = Math.min(lowest, v.y);
        expect(Math.abs(q.x), m.key).toBeLessThanOrEqual(m.width / 2 + 1e-3);
        expect(Math.abs(q.z), m.key).toBeLessThanOrEqual(m.depth / 2 + 1e-3);
        // Above a part's top only over a taller part, by the parapets and the name (1.5 m) at most:
        // the hall's upper storey stands over its body, not over its stair.
        const under = parts.filter((p) => near(p, q, 0.3));
        expect(v.y - m.floor, `${m.key} at (${q.x.toFixed(2)}, ${q.z.toFixed(2)})`).toBeLessThanOrEqual(Math.max(...under.map((p) => p.top)) + 1.5);
      }
      expect(lowest).toBeCloseTo(m.floor, 2);
    }
    // The roof the next stages use is the hall's body top.
    const hall = ALCHEMIA_MODULES[0]!;
    expect(ALCHEMIA_ROOF.corners.map((c) => local(hall, c)).every((q) => q.x <= bounds(alchemiaParts(hall)[0]!)[1] + 1e-6)).toBe(true);
    // The model's +X lies left of its front, as `alchemiaPoint` puts it.
    const p = alchemiaPoint(hall, 1, 0);
    expect(local(hall, p).x).toBeCloseTo(1, 6);
  });

  it("makes the hall's outside stair no higher than it is drawn: no wall over its podium, its run or its landing (G-288)", () => {
    const hall = ALCHEMIA_MODULES[0]!;
    const tris = hallFaces();
    const drawn = (x: number, z: number): number => Math.max(0, ...facesAt(tris, x, z));
    let checked = 0;
    // Over the stair's side of the hall, from the wall of its ground storey out to the podium's edge.
    for (let x = 2.35; x < 5.45; x += 0.25) {
      for (let z = -5.4; z < 5.5; z += 0.25) {
        // Within a few centimetres of a riser either tread may be the one drawn there.
        const top = Math.max(...[0, 0.15, -0.15].flatMap((dx) => [0, 0.15, -0.15].map((dz) => drawn(x + dx, z + dz))));
        for (const p of alchemiaParts(hall)) {
          // A part a body standing on the drawn top would meet: over the point, under its head.
          if (!insidePart(p, x, z) || (p.bottom ?? -Infinity) >= top + 1.8) continue;
          expect(p.top, `(${x.toFixed(2)}, ${z.toFixed(2)}) drawn ${top.toFixed(2)}`).toBeLessThanOrEqual(top + 0.45);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("keeps the hall's solid within its drawn walls wherever a body stands outside them: the podium, the porch, the balcony (G-297, G-298)", () => {
    const hall = ALCHEMIA_MODULES[0]!;
    const tris = hallFaces();
    const walls = new Map<number, [Pt, Pt][]>();
    const wallsOver = (y: number) => {
      const key = Math.round(y * 20) / 20;
      if (!walls.has(key)) walls.set(key, wallsAt(tris, key));
      return walls.get(key)!;
    };
    const [x0, x1, z0, z1] = [-hall.width / 2, hall.width / 2, -hall.depth / 2, hall.depth / 2];
    // Outside: a straight way out of the footprint from the point at a body's chest, along x or z, through no wall.
    const outside = (x: number, z: number, y: number): boolean => {
      const cuts = wallsOver(y);
      const blocked = (dir: 0 | 1 | 2 | 3) =>
        cuts.some(([a, b]) => {
          const along = dir < 2 ? [a.z - z, b.z - z, a.x, b.x] : [a.x - x, b.x - x, a.z, b.z];
          const [p, q, s, t] = along as [number, number, number, number];
          if (p * q > 0 || p === q) return false;
          const at = s + ((t - s) * p) / (p - q);
          return dir % 2 === 0 ? at > (dir < 2 ? x : z) : at < (dir < 2 ? x : z);
        });
      return ([0, 1, 2, 3] as const).some((d) => !blocked(d));
    };
    // A drawn wall (or the riser of a step) within `r` of the point between a body's feet and its head.
    const byWall = (x: number, z: number, y: number, r: number) =>
      [y + 0.3, y + 1, y + 1.6].some((h) => wallsOver(h).some(([a, b]) => segDist({ x, z }, a, b) < r));
    // Room for a body over a floor: nothing drawn under its head there, nor over a step higher a body's radius (0.38 m) round it.
    const room = (x: number, z: number, y: number, over: number | undefined) =>
      (over === undefined || over >= y + 1.8) &&
      [[0.38, 0], [-0.38, 0], [0, 0.38], [0, -0.38]].every(([dx, dz]) => !facesAt(tris, x + dx!, z + dz!).some((h) => h > y + 0.45 && h < y + 1.8));
    let standing = 0;
    const stuck: string[] = [];
    for (let x = x0 + 0.1; x < x1; x += 0.25) {
      for (let z = z0 + 0.1; z < z1; z += 0.25) {
        const hs = facesAt(tris, x, z);
        for (const [i, y] of hs.entries()) {
          if (!room(x, z, y, hs.slice(i + 1).find((h) => h > y + 0.05)) || !outside(x, z, y + 1.2) || byWall(x, z, y, 0.12)) continue;
          standing++;
          for (const p of alchemiaParts(hall))
            if (insidePart(p, x, z) && (p.bottom ?? -Infinity) < y + 1.8 && p.top > y + 0.45) stuck.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) on ${y.toFixed(2)} under ${p.top.toFixed(2)}`);
        }
      }
    }
    expect(stuck).toEqual([]);
    expect(standing).toBeGreaterThan(800);
  });
});

describe("Alchemia's view (ADR-0063 stage 4)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { x: ALCHEMIA_CENTRE.x, y: 2, z: ALCHEMIA_CENTRE.z - 60 };
    const box = { city: true, props: props as typeof props | null };
    const view = new AlchemiaView({ scene, kit: () => kit, props: () => box.props, city: () => box.city, eye: () => eye });
    return { scene, view, eye, box };
  };

  it("draws one mesh near the square, none far from it or without the map city", () => {
    const { scene, view, eye, box } = setup();
    view.update();
    expect(view.stats).toMatchObject({ meshes: 1, models: ALCHEMIA_MODULES.length });
    eye.z = ALCHEMIA_CENTRE.z - ALCHEMIA_DRAW - 5;
    view.update();
    expect(view.stats.meshes).toBe(1);
    eye.z -= 10;
    view.update();
    expect(view.stats.meshes).toBe(0);
    eye.z = ALCHEMIA_CENTRE.z;
    view.update();
    expect(view.stats.meshes).toBe(1);
    box.city = false;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(scene.meshes.filter((m) => m.name === "alchemia")).toHaveLength(1);
  });

  it("builds boxes before the props file and the models once it loads", () => {
    const { view, box } = setup();
    box.props = null;
    view.update();
    expect(view.stats.models).toBe(0);
    box.props = props;
    view.update();
    expect(view.stats.models).toBe(ALCHEMIA_MODULES.length);
  });

  it("stays out of the street scenes of npr-perf, all of them farther than it is drawn", () => {
    // Where the scenes' cameras end up (e2e/npr-perf.spec.ts): the start and the walk along the yaw.
    const scenes = [
      { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 },
      { x: 520, z: -63, yaw: Math.atan2(41, 23), walk: 60 },
      { x: 315, z: -92.9, yaw: 0, walk: 0 },
    ];
    for (const s of scenes) {
      for (const k of [0, 1]) {
        const x = s.x + Math.sin(s.yaw) * s.walk * k;
        const z = s.z + Math.cos(s.yaw) * s.walk * k;
        expect(Math.hypot(x - ALCHEMIA_CENTRE.x, z - ALCHEMIA_CENTRE.z)).toBeGreaterThan(ALCHEMIA_DRAW + 10);
      }
    }
  });
});
