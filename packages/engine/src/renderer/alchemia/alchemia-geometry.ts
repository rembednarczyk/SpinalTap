import type { Vec3 } from "@seki/core";
import { ALCHEMIA_PIECES, ALCHEMIA_TIER_PIECES, ATRIUM, MALL, MALL_OVER, type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, FOODHALL, FOODHALL_INNER, FRONT_OPENINGS } from "@seki/sim";
import { type BoxFace, type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { arkadyGeometry } from "./arkady-geometry";
import { frontSignGeometry } from "./front-sign-geometry";
import { deptakSignGeometry } from "./deptak-sign-geometry";
import { pavilionGeometry } from "./pavilion-geometry";
import { ledOfSlab } from "./rounded-slab";
import { LAWN, LEAF, band, lid, paneFrame, prismOutline, railing, slabOutline } from "./storey-facade";
import { venueSigns } from "./venue-signs";
import { escalatorGeometry, onEscalator } from "./escalator-geometry";
import { shopPiece, shopSigns } from "./shop-geometry";
import { foodhallGeometry, foodhallPiece } from "./foodhall-geometry";
import { greenSlope, ofGreenSlope } from "./green-slope";
import { PLASTER, arcadeFrontGeometry } from "./arcade-front-geometry";
import { p2Outside } from "./p2-geometry";
import { parkingOutside } from "./parking-geometry";
import { roofPaving, roofPiece } from "./roof-geometry";
import { PAVING, plazaPiece } from "./plaza-geometry";

/**
 * Alchemia by the investor's plan (ADR-0074 stage 1) as pieces of geometry on the city kit's
 * texture: the simulation's boxes (`ALCHEMIA_PIECES`) coloured by their kind, and what only the
 * eye needs: the front's frame, the food hall's signs (proper names in neon, `foodhall-geometry.ts`), the ceiling's
 * light strips. Two sinks: outside (the shell, the green roof, the lift's kiosk, the terraces'
 * steps, T2 with its stairs and the Arkady of stage 2, the pavilion on the corner of stage 3, P-1's ramp trench and stair house of stage 4,
 * the beds along the ramp of stage 7, the green tiers and the front's storeys over P-1 of 19.11), drawn from afar, and inside (units, counters, tables, the stairs, the lights), drawn near
 * only. Glass is opaque with the inside's warm light in it (ADR-0071's glass). Pure data, no Babylon.
 */

/** The kit's swatch of each kind of piece. */
const SWATCH: Readonly<Record<AlchemiaPieceKind, string>> = {
  wall: "wall-dark",
  glass: "shop-warm",
  roof: "roof",
  green: "plant",
  parapet: "trim-light",
  partition: "trim-light",
  counter: "metal",
  grille: "ac-grille",
  table: "door",
  bench: "trim",
  step: "trim-light",
  frame: "dark",
  shutter: "metal",
  memorial: "dark",
  floor: "roof",
  column: "trim-light",
  marking: "trim-light",
  charger: "neon-green",
  machine: "metal",
  lawn: "plant",
  pergola: "rust",
  lantern: "win-warm",
  led: "neon-cyan",
  // P-2's store (stage 5a): its own sinks colour these (`p2-geometry.ts`); here only for the table's sake.
  rack: "metal",
  pallet: "trim-light",
  rail: "metal",
  beacon: "neon-amber",
  // The front on Bajkowskiego (B1): the screens' cold light, the sign's dark box (C4: drawn by `front-sign-geometry.ts`).
  screen: "win-teal",
  sign: "dark",
  umbrella: "fabric-teal",
  "led-green": "neon-green",
  water: "glass-blue",
  vitrine: "glass-blue",
  // The gallery round the atrium (ADR-0093 O1): its glass drawn as a white frame, its escalators' steel.
  pane: "trim-light",
  escalator: "metal",
  // The house with arcades (C3): pale cream, the kit's paint tinted (`PLASTER`).
  plaster: "paint",
  // The gallery's shops (ADR-0093 O2): their own part colours them by their trade (`shop-geometry.ts`); here only for the table's sake.
  shopfront: "dark",
  goods: "paint",
  display: "win-teal",
  error: "neon-red",
  lamp: "win-white",
  pipe: "pipe",
  duct: "ac",
  cable: "cable",
  cup: "ac",
  steam: "win-white",
  carton: "fabric-amber",
  paper: "paint",
  // The green roof (ADR-0093 O4): its own part draws these (`roof-geometry.ts`); here only for the table's sake.
  planter: "plant",
  flower: "paint",
  panel: "glass-blue",
  mast: "metal",
  fan: "ac-grille",
  crate: "rust",
  laundry: "paint",
  can: "paint",
  // The square before the front (C5): dark wet paving, the hologram's glow, the kiosks' awnings (drawn sloping, `plaza-geometry.ts`), lit food, sign bands, the café's chairs (the roof's are drawn by `roof-geometry.ts`).
  paving: "wall-dark",
  holo: "win-teal",
  awning: "trim-light",
  food: "win-warm",
  "sign-red": "neon-red",
  "sign-amber": "neon-amber",
  // The front's rooms' ceiling panels (ADR-0093 O5): warm, the board's lit storeys behind their glass.
  "ceiling-light": "win-warm",
  chair: "dark",
};

/** The front's glass is lit up to this much over the floor (ADR-0074 §6: the front warm at night). */
const LIT_GLASS = 3.4;
/** The bars of Oyaji's grille are this far apart. */
const GRILLE_EVERY = 0.2;

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, skip?: ReadonlySet<BoxFace>, tint?: readonly [number, number, number]): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch), tint, skip);
};

/** Kinds that stand on a floor or the ground: nobody sees their bottom. */
const ON_FLOOR: ReadonlySet<AlchemiaPieceKind> = new Set(["wall", "glass", "green", "parapet", "partition", "counter", "table", "bench", "step", "memorial", "column", "charger", "machine", "lawn", "paving"]);

/**
 * The faces of a piece nobody sees: the bottom of one on a floor (not glass hanging as a lintel, which
 * starts over the floor), and the back of a step under the next one up its flight (same width, taller).
 */
const hiddenFaces = (p: AlchemiaPiece, steps: ReadonlyMap<string, AlchemiaPiece>): ReadonlySet<BoxFace> => {
  const out = new Set<BoxFace>();
  const b = p.box;
  if (ON_FLOOR.has(p.kind) && !(p.kind === "glass" && b.y1 - b.y0 < 1.2)) out.add("-y");
  if (p.kind === "step") {
    const k = (x0: number, x1: number, z0: number, z1: number) => `${x0.toFixed(3)}:${x1.toFixed(3)}:${z0.toFixed(3)}:${z1.toFixed(3)}`;
    const covers = (q: AlchemiaPiece | undefined) => q !== undefined && q.box.y1 >= b.y1 && q.box.y0 <= b.y0 + 0.06;
    for (const [face, key] of [
      ["+z", k(b.x0, b.x1, b.z1, b.z1 + (b.z1 - b.z0))],
      ["-z", k(b.x0, b.x1, b.z0 - (b.z1 - b.z0), b.z0)],
      ["+x", k(b.x1, b.x1 + (b.x1 - b.x0), b.z0, b.z1)],
      ["-x", k(b.x0 - (b.x1 - b.x0), b.x0, b.z0, b.z1)],
    ] as const) if (covers(steps.get(key))) out.add(face);
  }
  return out;
};

/** A piece's swatch: the roof's big slab is the green roof's paving between its lawns (T0, stage 7), the lift's glass a cooler light. */
const swatchOf = (p: AlchemiaPiece): string => {
  const b = p.box;
  if (p.kind === "roof" && (b.x1 - b.x0) * (b.z1 - b.z0) > 100) return "trim-light";
  if (p.kind === "glass" && b.x1 - b.x0 < 3 && b.z1 - b.z0 < 3) return "office";
  return SWATCH[p.kind];
};

/** The front's frame: mullions every 2 m and a transom, dark steel, a hand's breadth proud of the glass. */
const frontFrame = (sink: GeometrySink, data: CityKitData): void => {
  const z = FOODHALL.maxZ + 0.03;
  const [y0, y1] = [FOODHALL.floor, FOODHALL.ceiling];
  const uv = "dark";
  for (let x = FOODHALL.minX + 2; x < FOODHALL.maxX - 0.5; x += 2) {
    if (FRONT_OPENINGS.some((o) => x > o.x0 - 0.1 && x < o.x1 + 0.1)) continue;
    boxOf(sink, data, { x0: x - 0.06, x1: x + 0.06, z0: z - 0.05, z1: z + 0.05, y0, y1 }, uv);
  }
  boxOf(sink, data, { x0: FOODHALL.minX, x1: FOODHALL.maxX, z0: z - 0.05, z1: z + 0.06, y0: y1 - 0.25, y1 }, uv);
  // A neon band along the front over the way in: the hall's sign without a word.
  const way = FRONT_OPENINGS.find((o) => o.id === "entrance")!;
  boxOf(sink, data, { x0: way.x0 - 1, x1: way.x1 + 1, z0: z + 0.05, z1: z + 0.12, y0: FOODHALL.floor + way.top + 0.15, y1: FOODHALL.floor + way.top + 0.35 }, "neon-amber");
  // Fumiko's noren over her hatch on T1: red, as her old stall's.
  const hatch = FRONT_OPENINGS.find((o) => o.id === "fumiko-hatch")!;
  boxOf(sink, data, { x0: hatch.x0, x1: hatch.x1, z0: FOODHALL.maxZ + 0.04, z1: FOODHALL.maxZ + 0.1, y0: FOODHALL.floor + hatch.top - 0.5, y1: FOODHALL.floor + hatch.top }, "neon-red");
  // The floor, seen through the way in from afar too (the ground under the hall is dug out).
  const I = FOODHALL_INNER;
  boxOf(sink, data, { x0: I.minX, x1: I.maxX, z0: I.minZ, z1: I.maxZ, y0: FOODHALL.floor - 0.02, y1: FOODHALL.floor + 0.005 }, "trim-light");
};

/**
 * The ceiling's light strips round the atrium on P0 (open to the sky since ADR-0093 O1, its fountain
 * in it since O3), under the gallery's P1 over the walkways: warm (ADR-0074 §6).
 */
const ceilingLights = (sink: GeometrySink, data: CityKitData): void => {
  const y = FOODHALL.ceiling - 0.04;
  const [x0, x1, z0, z1] = [ATRIUM.x0 - 1.2, ATRIUM.x1 + 1.2, ATRIUM.z0 - 1.2, ATRIUM.z1 + 1.2];
  for (const z of [z0, z1 - 0.25]) boxOf(sink, data, { x0, x1, z0: z, z1: z + 0.25, y0: y - 0.06, y1: y }, "win-warm");
  for (const x of [x0, x1 - 0.25]) boxOf(sink, data, { x0: x, x1: x + 0.25, z0: z0 + 0.25, z1: z1 - 0.25, y0: y - 0.06, y1: y }, "win-warm");
};

export interface AlchemiaSinks {
  readonly outside: GeometrySink;
  readonly inside: GeometrySink;
  /** The green tiers over the hall (15.11): a building of its own, its own mesh and budget (ADR-0074 §7). */
  readonly tiers: GeometrySink;
}

const TIER_SET: ReadonlySet<AlchemiaPiece> = new Set(ALCHEMIA_TIER_PIECES);

/** A storey's slab: a roof piece a slab thick, big enough to be a floor (not L2's underside, nor a planter). */
const isSlab = (p: AlchemiaPiece): boolean => p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) >= 30;

/** A piece of the gallery's slabs (ADR-0093 O1): within its outline and overhang. */
const ofMall = (p: AlchemiaPiece): boolean =>
  p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && p.box.x0 >= MALL.x0 - MALL_OVER - 0.01 && p.box.x1 <= MALL.x1 + MALL_OVER + 0.01 && p.box.z0 >= MALL.z0 - 0.01 && p.box.z1 <= MALL.z1 + MALL_OVER + 0.01;

/**
 * The gallery's slab edges without light (ADR-0093 O1): it runs only along the facade (the edge's
 * outside off the body, but on the south, where the front stands against it) and round the atrium;
 * not on the joints between a ring's pieces nor round the cores and the shafts.
 */
const darkEdges = (pts: readonly { x: number; z: number }[]) => (i: number): boolean => {
  const a = pts[i]!;
  const b = pts[(i + 1) % pts.length]!;
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const x = (a.x + b.x) / 2 + ((b.z - a.z) / len) * 0.05;
  const z = (a.z + b.z) / 2 - ((b.x - a.x) / len) * 0.05;
  const inAtrium = x > ATRIUM.x0 && x < ATRIUM.x1 && z > ATRIUM.z0 && z < ATRIUM.z1;
  const outside = x < MALL.x0 - MALL_OVER + 0.01 || x > MALL.x1 + MALL_OVER - 0.01 || z > MALL.z1 + MALL_OVER - 0.01;
  return !(inAtrium || outside);
};

/**
 * A piece of the storeys drawn from its outline (19.11, the board 1:1): false when it is not one. The
 * front's glass is the gallery's since ADR-0093 O5 (`pane`, its frame only, its rooms behind it): the
 * fake rooms drawn behind it until then went with the solid boxes of glass.
 */
const outlinedPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  const pts = p.outline;
  if (!pts) return false;
  const b = p.box;
  if (TIER_SET.has(p) && ofMall(p)) slabOutline(sink, data, pts, b.y0, b.y1, "trim-light", SWATCH.led, darkEdges(pts));
  else if (p.kind === "pane") paneFrame(sink, data, pts, b.y0, b.y1);
  // The front's slabs (its storeys' rooms under them since ADR-0093 O5): the beam a ring, the ceiling the slab's underside.
  else if (isSlab(p)) slabOutline(sink, data, pts, b.y0, b.y1, "trim-light", SWATCH.led, undefined, true);
  else if (p.kind === "parapet") railing(sink, data, pts, b.y0, b.y1);
  else if (p.kind === "green" && pts.length === 4) {
    // A curtain of green over a slab's edge (C2): its sides and its top, nobody sees under it.
    band(sink, pts, b.y0, b.y1, swatchUv(data, "paint"), undefined, LEAF);
    lid(sink, pts, b.y1, 1, swatchUv(data, "paint"), LEAF);
  } else prismOutline(sink, data, pts, b.y0, b.y1, swatchOf(p));
  return true;
};

/** Alchemia's two sinks from the simulation's pieces. */
export const alchemiaGeometry = (data: CityKitData, pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES): AlchemiaSinks => {
  const outside = new GeometrySink();
  const inside = new GeometrySink();
  const tiers = new GeometrySink();
  const steps = new Map(pieces.filter((p) => p.kind === "step").map((p) => [`${p.box.x0.toFixed(3)}:${p.box.x1.toFixed(3)}:${p.box.z0.toFixed(3)}:${p.box.z1.toFixed(3)}`, p] as const));
  // The storeys' slabs, drawn round-cornered with their strip of light (B4); the simulation's straight strips go.
  const slabs = pieces.filter((p) => TIER_SET.has(p) && isSlab(p)).map((p) => p.box);
  for (const p of pieces) {
    const sink = TIER_SET.has(p) ? tiers : p.inside ? inside : outside;
    const b = p.box;
    if (TIER_SET.has(p) && p.kind === "led" && ledOfSlab(b, slabs)) continue;
    if (TIER_SET.has(p) && ofGreenSlope(p)) continue;
    // The green roof (ADR-0093 O4): its beds, pergolas, services and the residents' garden.
    if (roofPiece(sink, data, p)) continue;
    // The escalators' upright balustrades: drawn sloping (`escalator-geometry.ts`).
    if (p.kind === "escalator") continue;
    // The gallery's shops (ADR-0093 O2): by their trade, their shopfronts as frames.
    if (p.inside && shopPiece(sink, data, p)) continue;
    // The food hall on P3 and Fumiko's second place on P0 (O3): by their kitchens.
    if (p.inside && foodhallPiece(sink, data, p)) continue;
    // The square's umbrellas and awnings (C5): cones and sloping sheets.
    if (plazaPiece(sink, data, p)) continue;
    if (outlinedPiece(sink, data, p)) continue;
    // The front's glass: lit warm from the floor to a hand over the doors, a dark band over it to the ceiling.
    if (p.kind === "glass" && b.x1 - b.x0 >= 0.3 && b.z0 >= FOODHALL.maxZ - FOODHALL.wall - 0.01 && b.y1 - b.y0 > 1) {
      const lit = Math.min(b.y1, FOODHALL.floor + LIT_GLASS);
      if (lit > b.y0) boxOf(sink, data, { ...b, y1: lit }, "win-warm");
      if (b.y1 > lit) boxOf(sink, data, { ...b, y0: Math.max(b.y0, lit) }, "glass-dark");
      continue;
    }
    // The front's sign (C4): a lightbox with its frame (`front-sign-geometry.ts`), its light in the signs' mesh.
    if (p.kind === "sign") continue;
    // The screens outside (C4): a dark panel, its picture in the signs' mesh (`front-signs.ts`).
    if (p.kind === "screen" && !p.inside) {
      boxOf(sink, data, b, "glass-dark");
      continue;
    }
    // The shelter's screens (5d1): a dark panel with lit bands across it, a picture on a display, not a lit box.
    if (p.kind === "screen") {
      boxOf(sink, data, b, "glass-dark");
      const alongX = b.x1 - b.x0 >= b.z1 - b.z0;
      const proud = 0.02;
      const face = alongX ? { z0: b.z0 - proud, z1: b.z0 } : { x0: b.x0 - proud, x1: b.x0 };
      const bands = Math.max(3, Math.round((b.y1 - b.y0) / 0.45));
      const step = (b.y1 - b.y0) / bands;
      for (let k = 0; k < bands; k++) {
        const y0 = b.y0 + k * step + step * 0.18;
        const inset = (k * 0.37) % 1 < 0.5 ? 0.15 : 0.6;
        const span = alongX ? { x0: b.x0 + inset, x1: b.x1 - 0.15 } : { z0: b.z0 + inset, z1: b.z1 - 0.15 };
        boxOf(sink, data, { ...b, ...face, ...span, y0, y1: y0 + step * 0.55 }, k % 3 === 1 ? "neon-pink" : "win-teal");
      }
      continue;
    }
    // Oyaji's grille over his counter: bars, the shop seen through them.
    if (p.kind === "grille") {
      const alongX = b.x1 - b.x0 >= b.z1 - b.z0;
      const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
      for (let s = 0.1; s < len; s += GRILLE_EVERY) {
        const c = (alongX ? b.x0 : b.z0) + s;
        const mz = (b.z0 + b.z1) / 2;
        const mx = (b.x0 + b.x1) / 2;
        boxOf(sink, data, alongX ? { ...b, x0: c - 0.015, x1: c + 0.015, z0: mz - 0.015, z1: mz + 0.015 } : { ...b, z0: c - 0.015, z1: c + 0.015, x0: mx - 0.015, x1: mx + 0.015 }, SWATCH.grille);
      }
      continue;
    }
    // The storeys' green (C2): the board's fresh leaves, the kit's paint tinted; the house with arcades' plaster (C3).
    const leaf = TIER_SET.has(p) && (p.kind === "green" || p.kind === "lawn");
    const steel = p.kind === "step" && p.inside && onEscalator(b);
    const paving = p.kind === "paving";
    const tint = leaf ? (p.kind === "lawn" ? LAWN : LEAF) : p.kind === "plaster" ? PLASTER : paving ? PAVING : undefined;
    boxOf(sink, data, b, leaf || paving ? "paint" : steel ? "metal" : swatchOf(p), hiddenFaces(p, steps), tint);
  }
  frontFrame(outside, data);
  arkadyGeometry(outside, data);
  pavilionGeometry(outside, data);
  parkingOutside(outside, data);
  p2Outside(outside, data);
  roofPaving(outside, data);
  frontSignGeometry(tiers, data);
  deptakSignGeometry(tiers, data);
  greenSlope(tiers, data);
  arcadeFrontGeometry(tiers, data);
  foodhallGeometry(inside, data);
  ceilingLights(inside, data);
  escalatorGeometry(inside, data);
  shopSigns(inside, data);
  venueSigns(inside, data);
  return { outside, inside, tiers };
};
