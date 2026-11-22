import { ROOM_DETAIL_SHAPES } from "../../../packages/core/src";
import { ALCHEMIA_PIECES } from "../../../packages/sim/src/content/alchemia";
import type { InteriorDef, InteriorRoom } from "../../../packages/sim/src/content/interior-areas";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";

/*
 * The rules' measures of a room (`docs/zasady-lokacji.md` §12–§16, the user's rules of 22.11), as
 * far as data can tell them: its plan on the modular grid and its heights (§12), its three layers of
 * dressing, macro, meso and micro (§14), the micro layer in clusters (clutter clusters, §14) and its
 * visible sources of light (no light from nowhere, §13). The card's generated block shows them
 * under the inventory; the audit (`## Frakcja i zasady`) reads them. Pure data.
 */

export type Layer = "architektura" | "makro" | "mezo" | "mikro";

/** The grid of walls and floors (§12): plans in multiples of half a metre. */
export const GRID = 0.5;
/** A micro thing within this of another is in the same cluster (§14). */
export const CLUSTER_LINK = 1.2;
/** A cluster has at least this many things; fewer are strays. */
export const CLUSTER_MIN = 3;

/** A thing by its size (m): macro what one takes cover behind or what shapes the room, micro what fits in a hand. */
export const layerOfSize = (dx: number, dy: number, dz: number): Layer => {
  if (Math.max(dx, dz) >= 1.2 || dy >= 1.4) return "makro";
  if (Math.max(dx, dy, dz) < 0.35) return "mikro";
  return "mezo";
};

/** The game's furniture and models that are macro by what they are (§14): one takes cover behind them. */
const MACRO_MODELS = new Set(["vending", "kiosk", "tree", "car", "bus-stop", "container", "dumpster", "counter", "shelf", "rack", "planter", "billboard"]);
/** The room's architecture (§12's blockout: walls, slabs, steps, the services on show), not its dressing. */
const ARCHITECTURE = /^(partition|step|stairs?|cable|roof|shopfront|pipe|duct|wall|parapet|escalator|grille|glass|shutter|frame|floor|water|slab|beam|column|pillar|rail)$/;
/** Flat things on walls and floors (posters, stickers, stains, a terminal's error): the micro layer's narration (§14). */
const DECALS = /^(paper|poster|sticker|decal|stain|error|graffiti|tag)$/;
/** Names of things that give light (a lamp, a neon, a screen): §13's visible sources. */
const LIGHTS = /lamp|lantern|lampion|neon|led|screen|monitor|ekran|light|sign|holo|tv/i;

/** A drawn piece's layer: by its kind where it says (architecture, a light's fitting, a decal), else by its size. */
const pieceLayer = (kind: string, dx: number, dy: number, dz: number): Layer => {
  if (ARCHITECTURE.test(kind)) return "architektura";
  if (DECALS.test(kind)) return "mikro";
  if (LIGHTS.test(kind)) return "mezo";
  return layerOfSize(dx, dy, dz);
};

interface Thing {
  readonly name: string;
  readonly layer: Layer;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const inside = (r: InteriorRoom, x: number, y: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y >= r.bottom - 0.3 && y <= r.top;
const inAny = (i: InteriorDef, x: number, y: number, z: number): boolean => i.rooms.some((r) => inside(r, x, y, z));

/** Everything the game puts in an interior, with its layer and place (the inventory's three sources). */
export const thingsIn = (i: InteriorDef): Thing[] => {
  const out: Thing[] = [];
  for (const c of WORLD_CHUNKS)
    for (const p of [...c.props, ...(c.street ?? [])]) {
      const v = p.view as { kind: string; size?: { x: number; y: number; z: number } };
      if (v.kind === "street-props" || v.kind === "building") continue;
      if (!inAny(i, p.center.x, p.center.y, p.center.z)) continue;
      // A big interior block is a wall, a floor or a flight: architecture.
      const big = v.size !== undefined && Math.max(v.size.x, v.size.z) >= 2.5;
      const layer = big ? "architektura" : v.size ? layerOfSize(v.size.x, v.size.y, v.size.z) : "mezo";
      out.push({ name: v.kind, layer, x: p.center.x, y: p.center.y, z: p.center.z });
    }
  for (const s of WORLD_SCENERY) {
    if (s.view.kind !== "street-props") continue;
    for (const item of s.view.items) {
      const x = s.at.x + item.x;
      const y = s.at.y + item.y;
      const z = s.at.z + item.z;
      if (!inAny(i, x, y, z)) continue;
      const shape = item.prop === "room-detail" ? ROOM_DETAIL_SHAPES[item.variant % ROOM_DETAIL_SHAPES.length] : undefined;
      const layer: Layer = shape ? (shape.fine ? "mikro" : "mezo") : MACRO_MODELS.has(item.prop) ? "makro" : "mezo";
      out.push({ name: shape?.key ?? item.prop, layer, x, y, z });
    }
  }
  for (const p of ALCHEMIA_PIECES) {
    const b = p.box;
    const x = (b.x0 + b.x1) / 2;
    const z = (b.z0 + b.z1) / 2;
    if (!inAny(i, x, b.y0, z)) continue;
    out.push({ name: p.kind, layer: pieceLayer(p.kind, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0), x, y: b.y0, z });
  }
  return out;
};

/** The micro things in clusters (single linkage within `CLUSTER_LINK`): the clusters of `CLUSTER_MIN` or more and the strays. */
export const clusters = (things: readonly Thing[]): { readonly clusters: number; readonly clustered: number; readonly strays: number } => {
  const micro = things.filter((t) => t.layer === "mikro");
  const parent = micro.map((_, k) => k);
  const root = (k: number): number => (parent[k] === k ? k : (parent[k] = root(parent[k]!)));
  for (let a = 0; a < micro.length; a++)
    for (let b = a + 1; b < micro.length; b++) {
      const p = micro[a]!;
      const q = micro[b]!;
      if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= CLUSTER_LINK) parent[root(a)] = root(b);
    }
  const sizes = new Map<number, number>();
  micro.forEach((_, k) => sizes.set(root(k), (sizes.get(root(k)) ?? 0) + 1));
  const big = [...sizes.values()].filter((n) => n >= CLUSTER_MIN);
  const clustered = big.reduce((s, n) => s + n, 0);
  return { clusters: big.length, clustered, strays: micro.length - clustered };
};

const onGrid = (v: number): boolean => Math.abs(v / GRID - Math.round(v / GRID)) * GRID < 0.05;
const fmt = (v: number): string => v.toFixed(1).replace(".", ",");

/** The rules' measures of an interior as the lines of the card's generated block. */
export const measuresOf = (i: InteriorDef): string[] => {
  const things = thingsIn(i);
  const area = i.rooms.reduce((s, r) => s + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0);
  const sides = i.rooms.flatMap((r) => [r.maxX - r.minX, r.maxZ - r.minZ]);
  const heights = [...new Set(i.rooms.map((r) => fmt(r.top - r.bottom)))];
  const by = (l: Layer) => things.filter((t) => t.layer === l).length;
  const c = clusters(things);
  const lights = things.filter((t) => LIGHTS.test(t.name)).length;
  return [
    `- rzut: ${i.rooms.length} ${i.rooms.length === 1 ? "prostokąt" : "prostokąty"}, ${Math.round(area)} m², wysokość ${heights.join(" / ")} m`,
    `- siatka ${fmt(GRID)} m: ${sides.filter(onGrid).length} z ${sides.length} wymiarów`,
    `- architektura (ściany, płyty, stopnie, instalacje na wierzchu): ${by("architektura")}`,
    `- warstwy wyposażenia: makro ${by("makro")}, mezo ${by("mezo")}, mikro ${by("mikro")}`,
    `- drobiazg w skupiskach (≥ ${CLUSTER_MIN} w ${fmt(CLUSTER_LINK)} m): ${c.clusters} skupisk, ${c.clustered} rzeczy w nich, ${c.strays} luzem`,
    `- widoczne źródła światła (lampy, neony, ekrany, szyldy): ${lights}`,
  ];
};
