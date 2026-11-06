import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type GroundSurface, SURFACE_LIFT, type Vec3, type ViewDescriptor } from "../../../packages/core/src";
import { worldRing } from "../../../packages/engine/src/renderer/drones/drone-world";
import { type P2, pointInRing, signedArea, triangulate } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { parseExtract } from "../../osm-import/src/osm.ts";
import { grassUnderPaving, grassUnderPavingFindings } from "./grass-under-paving";

/**
 * Lawns under a square's paving (G-421, `grass-under-paving`): on a small world, and on Plac
 * Litewski (r7690183), a third of which is lawns, flowerbeds and heath (T-194).
 */

type Item = { view: ViewDescriptor; at: Vec3 };
const O: Vec3 = { x: 0, y: 0, z: 0 };
const ground = (surface: GroundSurface, outline: P2[]): Item => ({ view: { kind: "ground", surface, outline }, at: O });
const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

/** The drawn surface on top at a point within `box` (50 m round it read), null where none is. */
const drawnAt = (items: readonly Item[], box: { minX: number; maxX: number; minZ: number; maxZ: number }): ((p: P2) => GroundSurface | null) => {
  // The drawn triangles by the 4 m cells their boxes touch.
  const CELL = 4;
  const cells = new Map<string, { surface: GroundSurface; tri: [P2, P2, P2] }[]>();
  for (const { view, at } of items) {
    if (view.kind !== "ground") continue;
    const ring = worldRing(view.outline, at);
    if (ring.length < 3 || !ring.some((p) => p.x > box.minX - 50 && p.x < box.maxX + 50 && p.z > box.minZ - 50 && p.z < box.maxZ + 50)) continue;
    const t = triangulate(ring);
    for (let k = 0; k + 2 < t.length; k += 3) {
      const tri: [P2, P2, P2] = [ring[t[k]!]!, ring[t[k + 1]!]!, ring[t[k + 2]!]!];
      const [x0, x1] = [Math.min(...tri.map((p) => p.x)), Math.max(...tri.map((p) => p.x))];
      const [z0, z1] = [Math.min(...tri.map((p) => p.z)), Math.max(...tri.map((p) => p.z))];
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
        for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
          const list = cells.get(`${i},${j}`);
          if (list) list.push({ surface: view.surface, tri });
          else cells.set(`${i},${j}`, [{ surface: view.surface, tri }]);
        }
      }
    }
  }
  const cross = (a: P2, b: P2, p: P2) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
  const inTri = (p: P2, [a, b, c]: [P2, P2, P2]) => {
    const s = Math.sign(cross(a, b, c));
    return s !== 0 && cross(a, b, p) * s >= 0 && cross(b, c, p) * s >= 0 && cross(c, a, p) * s >= 0;
  };
  return (p) => {
    let top: GroundSurface | null = null;
    for (const q of cells.get(`${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`) ?? []) if ((top === null || SURFACE_LIFT[q.surface] > SURFACE_LIFT[top]) && inTri(p, q.tri)) top = q.surface;
    return top;
  };
};

const boxOf = (ring: readonly P2[]) => ({ minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) });

/** The drawn surface on top at each point of a 0.5 m grid inside `outline`: m² of each. */
const topSurfaces = (items: readonly Item[], outline: readonly P2[]): Map<GroundSurface, number> => {
  const box = boxOf(outline);
  const at = drawnAt(items, box);
  const out = new Map<GroundSurface, number>();
  for (let x = box.minX + 0.25; x < box.maxX; x += 0.5) {
    for (let z = box.minZ + 0.25; z < box.maxZ; z += 0.5) {
      const p = { x, z };
      if (!pointInRing(p, outline)) continue;
      const top = at(p);
      if (top) out.set(top, (out.get(top) ?? 0) + 0.25);
    }
  }
  return out;
};

const PLAC = () => extractFeatures(parseExtract(readFileSync(join(__dirname, "../../../data/osm/krakowskie.json"), "utf8"))).areas.find((a) => a.id === "r7690183")!.ring;

describe("grass-under-paving (G-421)", () => {
  it("measures the grass a square lays its paving over, and none it leaves open or a path crosses", () => {
    const lawn = ground("grass", rect(10, 10, 20, 20));
    expect(grassUnderPaving([ground("square", rect(0, 0, 40, 40)), lawn]).map((g) => g.area)).toEqual([100]);
    expect(grassUnderPavingFindings([ground("cobble", rect(15, 0, 40, 40)), lawn]).map((f) => f.what)).toEqual(["grass under paving: 50.0 m²"]);
    expect(grassUnderPavingFindings([ground("square", rect(0, 0, 40, 40)), ground("grass", rect(10, 10, 14, 14))])).toEqual([]);
    expect(grassUnderPaving([ground("footway", rect(0, 12, 40, 14)), ground("road", rect(0, 0, 40, 4)), lawn])).toEqual([]);
    // The square with the lawn cut out of it, joined to its outline by a seam of no width.
    const keyhole = [...rect(0, 0, 40, 40).slice(0, 2), { x: 40, z: 15 }, { x: 20, z: 15 }, { x: 20, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 20 }, { x: 20, z: 20 }, { x: 20, z: 15 }, { x: 40, z: 15 }, ...rect(0, 0, 40, 40).slice(2)];
    expect(grassUnderPaving([ground("square", keyhole), lawn])).toEqual([]);
    // A paved patch of a park, all on its lawn, is drawn over it as it should be.
    expect(grassUnderPaving([ground("square", rect(12, 12, 18, 18)), lawn])).toEqual([]);
  });

  // OSM maps 8 900 m² of them inside it (T-194), 8 010 m² drawn on top: paths crossing them lie over them, and the
  // playgrounds and gardens that touch a lawn stay under the paving (`openPavings`).
  it("shows Plac Litewski's lawns, flowerbeds and heath: over 8 000 m² of grass on top", () => {
    const top = topSurfaces(WORLD_SCENERY, PLAC());
    expect(top.get("grass") ?? 0).toBeGreaterThan(7800);
  });

  // The chunks' edges x = 20 and z = -20 cross the square's lawns: a lawn laid otherwise than its
  // hole where the edge cuts both left a strip of bare terrain across it (T-202).
  it("leaves no bare strip in Plac Litewski's lawns where a chunk's edge crosses them", () => {
    const areas = extractFeatures(parseExtract(readFileSync(join(__dirname, "../../../data/osm/krakowskie.json"), "utf8"))).areas;
    const plac = areas.find((a) => a.id === "r7690183")!.ring;
    // The lawns mapped in the square, and a point's distance to their edges.
    const lawns = areas.filter((a) => a.tags.landuse === "grass" && a.ring.every((p) => pointInRing(p, plac))).map((a) => a.ring);
    const gap = (p: P2, r: readonly P2[]) =>
      Math.min(...r.map((a, i) => {
        const b = r[(i + 1) % r.length]!;
        const [dx, dz] = [b.x - a.x, b.z - a.z];
        const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
      }));
    const inLawn = (p: P2) => lawns.some((r) => pointInRing(p, r) || gap(p, r) < 0.5);
    const at = drawnAt(WORLD_SCENERY, boxOf(plac));
    const box = boxOf(plac);
    const bare: string[] = [];
    const probe = (p: P2) => inLawn(p) && at(p) === null && bare.push(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    for (let d = -0.95; d < 1; d += 0.1) {
      for (let s = box.minX; s < box.maxX; s += 0.1) probe({ x: s, z: -20 + d });
      for (let s = box.minZ; s < box.maxZ; s += 0.1) probe({ x: 20 + d, z: s });
    }
    expect(lawns.length).toBeGreaterThan(30);
    expect(bare).toEqual([]);
  });

  it("lays every piece of paving with holes as the triangles of its own area", () => {
    const wrong = WORLD_SCENERY.flatMap(({ view, at }) => {
      if (view.kind !== "ground" || (view.surface !== "square" && view.surface !== "cobble")) return [];
      const ring = worldRing(view.outline, at);
      // A hole's seam visits its corners twice.
      if (new Set(ring.map((p) => `${p.x},${p.z}`)).size === ring.length) return [];
      const t = triangulate(ring);
      let laid = 0;
      for (let k = 0; k + 2 < t.length; k += 3) {
        const [a, b, c] = [ring[t[k]!]!, ring[t[k + 1]!]!, ring[t[k + 2]!]!];
        laid += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
      }
      const area = Math.abs(signedArea(ring));
      return Math.abs(laid - area) > 0.5 ? [`${ring[0]!.x},${ring[0]!.z}: ${laid.toFixed(1)} m² laid for ${area.toFixed(1)}`] : [];
    });
    expect(wrong).toEqual([]);
  });
});
