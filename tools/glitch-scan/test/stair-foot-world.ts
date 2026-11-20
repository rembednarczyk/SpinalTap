import type { StaticProp } from "../../../packages/sim/src/content/builders";
import { ALCHEMIA_PIECES, ARKADY_PIECES, P1_ALL_PIECES, SHELTER_HATCH_PIECES, SHELTER_PIECES, arkadyPoint, type AlchemiaPiece } from "../../../packages/sim/src/content/alchemia";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { METRO_STATIONS } from "../../../packages/sim/src/content/metro";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { GroundField } from "../../../packages/sim/src/world/ground";
import { type Prism, makePrism, prismsAt } from "../../../packages/sim/src/world/prism";
import { GroundIndex } from "./ground-index";
import { SCENE_SOLIDS, holds } from "./scene-solids";
import type { Foot, FloorKind, Pt, StairWorld, StepQuad } from "./stair-foot";

/**
 * The game's stairs and the ground round them as `stair-foot-unpaved` reads them: the scenes'
 * sloped flights (the chunks' props and rooms, the metro's pavilions), Alchemia's steps as pieces
 * (in the world's axes, P-1 and P-2 with the passage from metro B, the shelter, the Arkady's in
 * their frame), the scenes' solids, the simulation's ground (`GroundField` with the cuts and vaults
 * as streaming builds it) and the ground surfaces drawn (the map's and the scenes', W-3's yards).
 */

/** Surfaces of the map's ground a walker steps onto off a flight (paving of any kind). */
const PAVED: ReadonlySet<string> = new Set(["road", "sidewalk", "square", "cobble", "footway", "steps", "crossing"]);
/** Alchemia's green pieces: a lawn is no paving. */
const GREEN: ReadonlySet<string> = new Set(["lawn", "green"]);

const METRO = METRO_STATIONS.flatMap((s) => s.entrances);

/** A sloped flight's foot: the edge at its low end, the way down off it, the floor at its bottom. */
const slopeFoot = (p: StaticProp, what: string): Foot | null => {
  if (p.view.kind !== "block" || !p.view.slope?.steps || p.view.slope.low !== 0) return null;
  const { axis, dir } = p.view.slope;
  const [hx, hz] = [p.view.size.x / 2, p.view.size.z / 2];
  const { x, z } = p.center;
  const y = p.center.y - p.view.size.y / 2;
  // It rises towards `dir` along `axis`: its foot is the other end.
  if (axis === "x") {
    const e = x - dir * hx;
    return { a: { x: e, z: z - hz }, b: { x: e, z: z + hz }, out: { x: -dir, z: 0 }, y, what };
  }
  const e = z - dir * hz;
  return { a: { x: x - hx, z: e }, b: { x: x + hx, z: e }, out: { x: 0, z: -dir }, y, what };
};

/** Every sloped flight of the scenes with its foot. */
const flights = (): Foot[] => [
  ...WORLD_CHUNKS.flatMap((c) => [...c.props, ...(c.rooms ?? [])].flatMap((p) => slopeFoot(p, `${c.id} stairs`) ?? [])),
  ...METRO.flatMap((e) => e.props.flatMap((p) => slopeFoot(p, `metro ${e.name} ${e.label} stairs`) ?? [])),
];

const rect = (b: AlchemiaPiece["box"]): Pt[] => [
  { x: b.x0, z: b.z0 },
  { x: b.x1, z: b.z0 },
  { x: b.x1, z: b.z1 },
  { x: b.x0, z: b.z1 },
];

/** Alchemia's steps as quads, each piece once (the collections share some), the Arkady's turned into the world. */
const alchemiaSteps = (): StepQuad[] => {
  const seen = new Set<AlchemiaPiece>();
  const out: StepQuad[] = [];
  const add = (pieces: readonly AlchemiaPiece[], what: string, frame?: (p: Pt) => Pt) => {
    for (const p of pieces) {
      if (p.kind !== "step" || seen.has(p)) continue;
      seen.add(p);
      const ring = frame ? rect(p.box).map(frame) : (p.outline ?? rect(p.box));
      out.push({ ring, top: p.box.y1, bottom: p.box.y0, what });
    }
  };
  add(ALCHEMIA_PIECES, "Alchemia step");
  add(P1_ALL_PIECES, "Alchemia P-1/P-2 step");
  add(SHELTER_PIECES, "Alchemia shelter step");
  add(SHELTER_HATCH_PIECES, "Alchemia shelter hatch step");
  add(ARKADY_PIECES, "Arkady step", (q) => arkadyPoint(q.x, q.z));
  return out;
};

/** Alchemia's lawns as prisms: a floor that is no paving. */
const lawns = (): Prism[] => ALCHEMIA_PIECES.filter((p) => GREEN.has(p.kind) && p.box.y1 > p.box.y0).map((p) => makePrism(p.outline ?? rect(p.box), p.box.y0, p.box.y1));

/** The metro pavilions' solids: streamed with their entrances, not in the chunks. */
const metroSolids = (): Prism[] =>
  METRO.flatMap((e) =>
    e.props.flatMap((p) => {
      if (!p.solid) return [];
      if (p.prisms) return prismsAt(p.prisms, p.center);
      if (p.view.kind !== "block") return [];
      const { x, y, z } = p.view.size;
      const o = p.center;
      return [makePrism(rect({ x0: o.x - x / 2, x1: o.x + x / 2, z0: o.z - z / 2, z1: o.z + z / 2, y0: 0, y1: 0 }), o.y - y / 2, o.y + y / 2)];
    }),
  );

/** Every ground surface of the scenery, the map's and the scenes', as one table for `GroundIndex`. */
const drawnGround = (): GroundIndex => {
  const ground = WORLD_SCENERY.flatMap((s) => (s.view.kind === "ground" ? [{ surface: s.view.surface, outline: s.view.outline.flatMap((p) => [p.x + s.at.x, p.z + s.at.z]) }] : []));
  return new GroundIndex([{ id: "scenery", bounds: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity }, ground }]);
};

/** Prisms by 4 m square of their boxes. */
class PrismIndex {
  private readonly bins = new Map<number, Prism[]>();

  constructor(prisms: readonly Prism[]) {
    for (const p of prisms) {
      for (let i = Math.floor(p.box.min.x / 4); i <= Math.floor(p.box.max.x / 4); i++) {
        for (let k = Math.floor(p.box.min.z / 4); k <= Math.floor(p.box.max.z / 4); k++) {
          const key = i * 65536 + k;
          const list = this.bins.get(key);
          if (list) list.push(p);
          else this.bins.set(key, [p]);
        }
      }
    }
  }

  at(x: number, z: number): Prism[] {
    return (this.bins.get(Math.floor(x / 4) * 65536 + Math.floor(z / 4)) ?? []).filter((p) => holds(p, x, z));
  }
}

/** The game round its stairs. */
export const cityStairWorld = (): StairWorld => {
  const solids = new PrismIndex([...SCENE_SOLIDS(), ...metroSolids()]);
  const green = new PrismIndex(lawns());
  const field = new GroundField(WORLD_CHUNKS, [...METRO.map((e) => e.cut), ...WORLD_CHUNKS.flatMap((c) => c.cuts ?? [])], [...METRO.flatMap((e) => e.platform?.vaults ?? []), ...WORLD_CHUNKS.flatMap((c) => c.vaults ?? [])]);
  const surfaces = drawnGround();
  /** The ground's floor: a dug one, a deck's or a vault's is a floor, the terrain's by the map's surfaces on it. */
  const groundKind = (x: number, z: number, g: number): FloorKind => {
    if (field.shaftAt(x, z) >= 0 || Math.abs(g - groundY(x, z)) > 0.02) return "floor";
    return surfaces.at(x, z).some((s) => PAVED.has(s)) ? "paved" : "bare";
  };
  return {
    steps: alchemiaSteps(),
    flights: flights(),
    floorAt: (x, z, y) => {
      let best: { top: number; kind: FloorKind } | null = null;
      const g = field.heightAt(x, z, y);
      if (g <= y) best = { top: g, kind: groundKind(x, z, g) };
      for (const p of solids.at(x, z)) if (p.top <= y && p.top > (best?.top ?? -Infinity)) best = { top: p.top, kind: "floor" };
      // A lawn laid on a slab or the ground: its top is the floor there.
      for (const p of green.at(x, z)) if (p.top <= y && p.top >= (best?.top ?? -Infinity) - 0.05) best = { top: p.top, kind: "lawn" };
      return best;
    },
    solidIn: (x, z, y0, y1) => field.heightAt(x, z, y0) > y0 || solids.at(x, z).some((p) => p.bottom < y1 && p.top > y0),
  };
};
