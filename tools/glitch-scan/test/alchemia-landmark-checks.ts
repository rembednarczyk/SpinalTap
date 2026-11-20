import { readFileSync } from "node:fs";
import { ALCHEMIA_MEMORIAL, ALCHEMIA_PIECES, type AlchemiaPiece } from "../../../packages/sim/src/content/alchemia";
import { ARCADE_FRONT } from "../../../packages/sim/src/content/alchemia/arcade-front";
import { W3_GATE } from "../../../packages/sim/src/content/tessen-w3/site";
import { WORLD_CHUNKS, WORLD_DEVICES } from "../../../packages/sim/src/content/world-map";
import { deviceView } from "../../../packages/sim/src/content/devices";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { buildingView } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { type CityKitData, GeometrySink, parseCityKit, swatchUv } from "../../../packages/engine/src/renderer/city-kit-data";
import { DEPTAK_SIGNS, type DeptakSign, planDeptakSigns } from "../../../packages/engine/src/renderer/alchemia/deptak-signs";
import { foodhallGeometry } from "../../../packages/engine/src/renderer/alchemia/foodhall-geometry";
import { planAlchemiaSigns } from "../../../packages/engine/src/renderer/alchemia/front-signs";
import { neonWidth } from "../../../packages/engine/src/renderer/alchemia/neon-letters";
import { pavilionFaces } from "../../../packages/engine/src/renderer/alchemia/pavilion-shape";
import { shopSigns } from "../../../packages/engine/src/renderer/alchemia/shop-geometry";
import { type AcrossAt, SPAN_MAX, findSpans } from "../../../packages/engine/src/renderer/mapcity/canyon-plan";
import { planCanyonSigns } from "../../../packages/engine/src/renderer/mapcity/canyon-signs";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { isLandmarkFrame, landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { planLandmarkSigns } from "../../../packages/engine/src/renderer/mapcity/landmarks/landmark-signs";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type Box2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, NEAR_ONLY, planBuildingSigns } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { planVenueSigns } from "../../../packages/engine/src/renderer/mapcity/venue-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { W3_NEON } from "../../../packages/engine/src/renderer/tessen-w3/w3-dress";
import { geoToWorld } from "../../osm-import/src/project.ts";

/**
 * The glitch scan's checks of Alchemia's landmarks proposed by the topography's curator in the
 * reviews of ADR-0074 and ADR-0093: the memorial of Plac Ofiar Getta and the stumbling stones kept
 * clear of neon (§6 of ADR-0074).
 */

type Finding = { readonly at: string; readonly what: string };
type GroundPoint = { readonly x: number; readonly z: number };

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** A place of remembrance kept clear of neon: its box on the plan (a stumbling stone's is its node). */
export interface Remembrance {
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A glowing sign, or a piece of one (a letter, a quad, a tube): what draws it, its kind, its points on the plan. */
export interface Glow {
  readonly source: string;
  readonly kind: string;
  readonly points: readonly GroundPoint[];
}

/** No glowing sign nearer a place of remembrance than this, across the plan (m). */
export const MEMORIAL_CLEAR = 20;
/** Two points of one source's glow this close are one sign (m): the gap between a sign's letters is under it. */
const ONE_SIGN = 1.5;

/** The memorial stone of Plac Ofiar Getta on T2 (ADR-0074 stage 2) and the map's stumbling stones (`memorial=stolperstein`). */
export const remembrances = (nodes: Iterable<{ readonly lat: number; readonly lon: number; readonly tags?: Readonly<Record<string, string>> }>): Remembrance[] => {
  const m = ALCHEMIA_MEMORIAL;
  const out: Remembrance[] = [{ name: "the memorial of Plac Ofiar Getta", x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1 }];
  for (const n of nodes) {
    if (n.tags?.memorial !== "stolperstein") continue;
    const p = geoToWorld(n.lat, n.lon);
    out.push({ name: `the stumbling stone ${n.tags.name ?? ""}`.trim(), x0: p.x, x1: p.x, z0: p.z, z1: p.z });
  }
  return out;
};

const offBox = (p: GroundPoint, r: Remembrance): number => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.z0 - p.z, 0, p.z - r.z1));

type Close = { readonly p: GroundPoint; readonly piece: number; readonly kind: string; readonly d: number; readonly r: Remembrance };

/** Single-link groups of the points: one piece's together, two pieces' when points of them are `ONE_SIGN` apart at most. */
const signsOf = (close: readonly Close[]): Close[][] => {
  const group = close.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  for (let i = 0; i < close.length; i++) {
    for (let j = i + 1; j < close.length; j++) {
      const [a, b] = [close[i]!, close[j]!];
      if (a.piece === b.piece || Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z) <= ONE_SIGN) group[root(i)] = root(j);
    }
  }
  const by = new Map<number, Close[]>();
  close.forEach((c, i) => by.set(root(i), [...(by.get(root(i)) ?? []), c]));
  return [...by.values()];
};

/**
 * `memorial-neon-clear` (the curator's reviews of Alchemia, ADR-0074 §6): a glowing sign nearer
 * than 20 m across the plan to the memorial of Plac Ofiar Getta or a stumbling stone. One finding
 * a sign (a source's points within `ONE_SIGN` of each other), at the middle of its part within reach.
 */
export const memorialNeonClear = (places: readonly Remembrance[], glows: readonly Glow[]): Finding[] => {
  const bySource = new Map<string, Close[]>();
  glows.forEach((g, piece) => {
    for (const p of g.points) {
      let best: Close | null = null;
      for (const r of places) {
        const d = offBox(p, r);
        if (d < MEMORIAL_CLEAR && (!best || d < best.d)) best = { p, piece, kind: g.kind, d, r };
      }
      if (best) bySource.set(g.source, [...(bySource.get(g.source) ?? []), best]);
    }
  });
  return [...bySource].flatMap(([source, close]) =>
    signsOf(close).map((s) => {
      const x = s.reduce((a, c) => a + c.p.x, 0) / s.length;
      const z = s.reduce((a, c) => a + c.p.z, 0) / s.length;
      const nearest = s.reduce((a, c) => (c.d < a.d ? c : a));
      const kinds = [...new Set(s.map((c) => c.kind))].sort().join("+");
      return { at: near(x, z), what: `${source} ${kinds} ${nearest.d.toFixed(1)} m off ${nearest.r.name}` };
    }),
  );
};

/** The map signs' kinds that glow: boards, blades, discs, tubes, holograms, adverts, venues' boards and letters, screens (not the plates, the streaks, beams, mist or strobes). */
const GLOWING: ReadonlyMap<number, string> = new Map(
  (["board", "holo", "tube", "blade", "disc", "ad", "venue", "glyph", "screen"] as const).map((k) => [MAP_SIGN_KIND[k], k]),
);

/** The glowing quads of a map city's sign mesh, each its corners. */
export const meshGlows = (sink: MeshSink, source: string): Glow[] => {
  const out: Glow[] = [];
  for (let v = 0; v + 3 < sink.vertexCount; v += 4) {
    const kind = GLOWING.get(Math.round(sink.uvs2[v * 2 + 1]!) % NEAR_ONLY.kind);
    if (kind === undefined) continue;
    out.push({ source, kind, points: [0, 1, 2, 3].map((k) => ({ x: sink.positions[(v + k) * 3]!, z: sink.positions[(v + k) * 3 + 2]! })) });
  }
  return out;
};

/**
 * The map buildings' signs within reach of the places as the map city plans them (ADR-0044,
 * ADR-0051, ADR-0064): the shops' boards, blades and discs, the holograms, the venues' boards, the
 * adverts on the walls and over the streets (a span reaches `SPAN_MAX` off its building).
 */
export const mapSignGlows = (places: readonly Remembrance[]): Glow[] => {
  const reach = MEMORIAL_CLEAR + SPAN_MAX;
  const data = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)).map((b) => ({ b, district: c.district })));
  const sources = data.map(({ b, district }): BuildingSource => {
    const view = buildingView(b, district) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  });
  const index = new BinIndex();
  sources.forEach((s, i) => index.add(i, boundsOf(s.ring)));
  const inside = (x: number, z: number, self: number): number[] => [...index.at(x, z)].filter((o) => o !== self && pointInRing({ x, z }, sources[o]!.ring));
  // As `MapEntries` answers them for the map city (`sign-neighbours.ts`, `cable-spans.ts`).
  const neighbour = (x: number, z: number, self: number): number | null => {
    const tops = inside(x, z, self).map((o) => sources[o]!.at.y + sources[o]!.view.height);
    return tops.length ? Math.max(...tops) : null;
  };
  const nearBy = (box: Box2, self: number): Box2[] => [...index.within(box)].filter((o) => o !== self).map((o) => boundsOf(sources[o]!.ring));
  const across: AcrossAt = (x, z, self) => {
    const o = inside(x, z, self)[0];
    if (o === undefined) return null;
    const s = sources[o]!;
    return { id: o, top: s.at.y + s.view.height, clutter: s.view.vertical?.clutter ?? 0 };
  };
  const out: Glow[] = [];
  for (const r of places) {
    for (const i of index.within({ minX: r.x0 - reach, maxX: r.x1 + reach, minZ: r.z0 - reach, maxZ: r.z1 + reach })) {
      const s = sources[i]!;
      const built = mapBuilding(i, s, groundY, [...index.within(boundsOf(s.ring))].map((o) => sources[o]!));
      const f = withLandmark(facadeFrame(built, neighbour, nearBy), landmarkAt(s.at.x, s.at.z, s.view.outline.length));
      const sink = new MeshSink();
      if (isLandmarkFrame(f)) planLandmarkSigns(sink, f, () => 0);
      else {
        planBuildingSigns(sink, f, () => 0);
        planVenueSigns(sink, f);
      }
      planCanyonSigns(sink, [f], findSpans(f, across), false);
      out.push(...meshGlows(sink, `map signs of ${data[i]!.b.id}`));
    }
  }
  return out;
};

/** The whole plan: Alchemia's and the deptak's signs stand in any cell. */
const EVERYWHERE: Box2 = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };

/** Alchemia's light in the map city's signs: the front's sign, holograms and screens (C4), and the deptak's neons (C7). */
export const alchemiaSignGlows = (pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES, deptak: readonly DeptakSign[] = DEPTAK_SIGNS): Glow[] => {
  const front = new MeshSink();
  planAlchemiaSigns(front, EVERYWHERE, pieces);
  const street = new MeshSink();
  planDeptakSigns(street, EVERYWHERE, deptak);
  return [...meshGlows(front, "Alchemia's front (C4)"), ...meshGlows(street, "the deptak's neons (C7)")];
};

let kit: CityKitData | null = null;
const cityKit = (): CityKitData => {
  if (kit) return kit;
  const b = readFileSync(new URL("../../../packages/app/public/city/city-kit.glb", import.meta.url));
  kit = parseCityKit(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  return kit;
};

/** The triangles of a sink drawn in the kit's neon tubes (`neon-*` swatches), each a piece of a sign. */
const neonTriangles = (sink: GeometrySink, data: CityKitData, source: string): Glow[] => {
  const neon = new Set(data.swatches.filter((s) => s.name.startsWith("neon-")).map((s) => swatchUv(data, s.name).join(",")));
  const lit = (v: number) => neon.has(`${sink.uvs[v * 2]},${sink.uvs[v * 2 + 1]}`);
  const out: Glow[] = [];
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const tri = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
    if (tri.every(lit)) out.push({ source, kind: "neon", points: tri.map((v) => ({ x: sink.positions[v * 3]!, z: sink.positions[v * 3 + 2]! })) });
  }
  return out;
};

/** A neon's plate on the plan, `half` either way of its middle along x and z. */
const plate = (source: string, x: number, z: number, hx: number, hz: number): Glow => ({
  source,
  kind: "neon",
  points: [
    { x: x - hx, z: z - hz },
    { x: x + hx, z: z - hz },
    { x: x + hx, z: z + hz },
    { x: x - hx, z: z + hz },
  ],
});

/**
 * The neons of the game's own (`neon-letters.ts` and the neon views): the gallery's shops' names (O2)
 * and the food hall's (O3) in their lit tubes, the pavilion's ALCHEMIA, the arcade house's, W-3's
 * TESSEN, every neon sign of the world's props and the devices' neons.
 */
export const gameNeonGlows = (): Glow[] => {
  const data = cityKit();
  const shops = new GeometrySink();
  shopSigns(shops, data);
  const hall = new GeometrySink();
  foodhallGeometry(hall, data);
  const pavilion: GroundPoint[] = [];
  pavilionFaces((c, _n, look) => {
    if (look === "neon") pavilion.push(...c.map((p) => ({ x: p.x, z: p.z })));
  });
  const A = ARCADE_FRONT;
  // The arcade house's ALCHEMIA over its middle arch is drawn in the windows' warm swatch: placed as `arcade-front-geometry.ts` places it.
  const arcadeHalf = neonWidth("ALCHEMIA", 0.5) / 2;
  const w3Half = neonWidth("TESSEN", W3_NEON.height) / 2 + 0.6;
  const props = WORLD_CHUNKS.flatMap((c) => c.props.flatMap((p) => (p.view.kind === "neon" ? [plate(`neon ${p.view.label ?? p.view.color}`, p.center.x, p.center.z, p.view.size.x / 2, p.view.size.z / 2)] : [])));
  const devices = WORLD_DEVICES.flatMap((d) => {
    const view = deviceView(d.kind);
    if (view.kind !== "neon") return [];
    // Turned by its yaw: the plate's square on the plan holds it either way.
    const half = Math.max(view.size.x, view.size.z) / 2;
    return [plate(`device ${d.key}`, d.position.x, d.position.z, half, half)];
  });
  return [
    ...neonTriangles(shops, data, "the gallery's shop signs (O2)"),
    ...neonTriangles(hall, data, "the food hall's signs (O3)"),
    { source: "the pavilion's neon", kind: "neon", points: pavilion },
    plate("the arcade house's lettering", (A.minX + A.maxX) / 2, A.minZ, arcadeHalf, 0.05),
    plate("W-3's TESSEN", W3_NEON.face, (W3_GATE.minZ + W3_GATE.maxZ) / 2, 0.1, w3Half),
    ...props,
    ...devices,
  ];
};

/** Every glowing sign the check looks at, the map's only within reach of the places. */
export const glowsInGame = (places: readonly Remembrance[]): Glow[] => [...mapSignGlows(places), ...alchemiaSignGlows(), ...gameNeonGlows()];
