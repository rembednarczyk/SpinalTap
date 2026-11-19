import type { Vec3 } from "@seki/core";
import { ALCHEMIA_PIECES, ALCHEMIA_TIER_PIECES, ALCHEMIA_UNITS, ATRIUM, FRONT_SIGN, MALL, MALL_OVER, type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, FOODHALL, FOODHALL_INNER, FRONT_OPENINGS } from "@seki/sim";
import { type BoxFace, type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { arkadyGeometry } from "./arkady-geometry";
import { neonText } from "./neon-letters";
import { pavilionGeometry } from "./pavilion-geometry";
import { ledOfSlab } from "./rounded-slab";
import { LAWN, LEAF, band, glassFacade, lid, paneFrame, prismOutline, railing, slabOutline } from "./storey-facade";
import { escalatorGeometry, onEscalator } from "./escalator-geometry";
import { greenSlope, ofGreenSlope } from "./green-slope";
import { p2Outside } from "./p2-geometry";
import { parkingOutside } from "./parking-geometry";

/**
 * Alchemia by the investor's plan (ADR-0074 stage 1) as pieces of geometry on the city kit's
 * texture: the simulation's boxes (`ALCHEMIA_PIECES`) coloured by their kind, and what only the
 * eye needs: the front's frame, the units' signs (proper names, drawn without words), the ceiling's
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
  car: "metal",
  tyre: "tyre",
  rail: "metal",
  beacon: "neon-amber",
  // The front on Bajkowskiego (B1): the screens' cold light, the sign's dark box under its letters.
  screen: "win-teal",
  sign: "dark",
  umbrella: "fabric-teal",
  "led-green": "neon-green",
  water: "glass-blue",
  vitrine: "glass-blue",
  // The gallery round the atrium (ADR-0093 O1): its glass drawn as a white frame, its escalators' steel.
  pane: "trim-light",
  escalator: "metal",
};

/** The signs' neon by the unit's kitchen: the kit's glow swatches. */
const SIGN: Readonly<Record<string, string>> = {
  ramen: "neon-red",
  okonomiyaki: "neon-amber",
  "umbrellas-tea": "neon-cyan",
  coffee: "win-warm",
  arms: "neon-green",
  thai: "neon-violet",
  korean: "neon-pink",
  greek: "neon-blue",
  georgian: "neon-red",
  wok: "neon-amber",
  burger: "neon-pink",
  kiosk: "win-teal",
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
const ON_FLOOR: ReadonlySet<AlchemiaPieceKind> = new Set(["wall", "glass", "green", "parapet", "partition", "counter", "table", "bench", "step", "memorial", "column", "charger", "machine", "lawn"]);

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

/** A sign over each open unit's counter: a lit band in its kitchen's colour, under the ceiling. */
const unitSigns = (sink: GeometrySink, data: CityKitData): void => {
  const [y0, y1] = [FOODHALL.ceiling - 0.55, FOODHALL.ceiling - 0.2];
  for (const u of ALCHEMIA_UNITS) {
    if (u.shut) continue;
    const q = u.rect;
    const s = SIGN[u.cuisine] ?? "neon-cyan";
    if (u.open === "n" || u.open === "s") {
      const z = u.open === "n" ? q.maxZ - 0.15 : q.minZ + 0.05;
      if (u.id === "fumiko") continue;
      boxOf(sink, data, { x0: q.minX + 0.4, x1: q.maxX - 0.4, z0: z, z1: z + 0.1, y0, y1 }, s);
    } else {
      const x = u.open === "e" ? q.maxX - 0.15 : q.minX + 0.05;
      boxOf(sink, data, { x0: x, x1: x + 0.1, z0: q.minZ + 0.4, z1: q.maxZ - 0.4, y0, y1 }, s);
    }
  }
};

/**
 * The letters on the front's sign (B1, 19.11), on its south face towards Bajkowskiego: ALCHEMIA in
 * cyan over CENTRUM HANDLOWE in pink, neon tubes a hand proud of the dark box (the mall's own sign,
 * the same in every language).
 */
const frontSignLetters = (sink: GeometrySink, data: CityKitData): void => {
  const b = FRONT_SIGN;
  const mid = (b.x0 + b.x1) / 2;
  const face = b.z0;
  const line = (text: string, height: number, foot: number, swatch: string) => {
    for (const s of neonText(text, height)) boxOf(sink, data, { x0: mid + s.x0, x1: mid + s.x1, z0: face - 0.08, z1: face, y0: foot + s.y0, y1: foot + s.y1 }, swatch);
  };
  const h = b.y1 - b.y0;
  line("ALCHEMIA", h * 0.45, b.y0 + h * 0.42, "neon-cyan");
  line("CENTRUM HANDLOWE", h * 0.2, b.y0 + h * 0.1, "neon-pink");
};

/**
 * The ceiling's light strips round the atrium (open to the sky over the tables since ADR-0093 O1),
 * under the gallery's P1 over the aisles: warm (ADR-0074 §6).
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

type Outline = readonly { readonly x: number; readonly z: number }[];

/** Is (x, z) inside a convex counter-clockwise outline? */
const within = (pts: Outline, x: number, z: number): boolean =>
  pts.every((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x) >= 0;
  });

/** The edges of a storey's glass that stand inside another's (the joints between a storey's bars, a wing under the next storey up): nothing to draw on them. */
const hiddenEdges = (p: AlchemiaPiece, glass: readonly AlchemiaPiece[]): ((i: number) => boolean) => {
  const pts = p.outline!;
  const y = (p.box.y0 + p.box.y1) / 2;
  const others = glass.filter((g) => g !== p && g.box.y0 < y && g.box.y1 > y);
  return (i) => {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // Half a metre out of the edge's middle.
    const x = (a.x + b.x) / 2 + ((b.z - a.z) / len) * 0.5;
    const z = (a.z + b.z) / 2 - ((b.x - a.x) / len) * 0.5;
    return others.some((g) => within(g.outline!, x, z));
  };
};

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

/** A piece of the storeys drawn from its outline (19.11, the board 1:1): false when it is not one. */
const outlinedPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece, glass: readonly AlchemiaPiece[]): boolean => {
  const pts = p.outline;
  if (!pts) return false;
  const b = p.box;
  if (TIER_SET.has(p) && ofMall(p)) slabOutline(sink, data, pts, b.y0, b.y1, "trim-light", SWATCH.led, darkEdges(pts));
  else if (p.kind === "pane") paneFrame(sink, data, pts, b.y0, b.y1);
  else if (isSlab(p)) slabOutline(sink, data, pts, b.y0, b.y1, "trim-light", SWATCH.led);
  else if (p.kind === "glass") glassFacade(sink, data, pts, b.y0, b.y1, hiddenEdges(p, glass));
  else if (p.kind === "parapet") {
    // A roof's balustrade under the next storey up stands in its glass: not drawn.
    const [x, z] = [pts.reduce((s, q) => s + q.x, 0) / pts.length, pts.reduce((s, q) => s + q.z, 0) / pts.length];
    const y = (b.y0 + b.y1) / 2;
    if (!glass.some((g) => g.box.y0 < y && g.box.y1 > y && within(g.outline!, x, z))) railing(sink, data, pts, b.y0, b.y1);
  }
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
  const glass = pieces.filter((p) => p.kind === "glass" && p.outline);
  for (const p of pieces) {
    const sink = TIER_SET.has(p) ? tiers : p.inside ? inside : outside;
    const b = p.box;
    if (TIER_SET.has(p) && p.kind === "led" && ledOfSlab(b, slabs)) continue;
    if (TIER_SET.has(p) && ofGreenSlope(p)) continue;
    // The escalators' upright balustrades: drawn sloping (`escalator-geometry.ts`).
    if (p.kind === "escalator") continue;
    if (outlinedPiece(sink, data, p, glass)) continue;
    // The front's glass: lit warm from the floor to a hand over the doors, a dark band over it to the ceiling.
    if (p.kind === "glass" && b.x1 - b.x0 >= 0.3 && b.z0 >= FOODHALL.maxZ - FOODHALL.wall - 0.01 && b.y1 - b.y0 > 1) {
      const lit = Math.min(b.y1, FOODHALL.floor + LIT_GLASS);
      if (lit > b.y0) boxOf(sink, data, { ...b, y1: lit }, "win-warm");
      if (b.y1 > lit) boxOf(sink, data, { ...b, y0: Math.max(b.y0, lit) }, "glass-dark");
      continue;
    }
    // The front's screens (B1): a dark panel with lit bands across it, a picture on a display, not a lit box.
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
    // The storeys' green (C2): the board's fresh leaves, the kit's paint tinted.
    const leaf = TIER_SET.has(p) && (p.kind === "green" || p.kind === "lawn");
    const steel = p.kind === "step" && p.inside && onEscalator(b);
    boxOf(sink, data, b, leaf ? "paint" : steel ? "metal" : swatchOf(p), hiddenFaces(p, steps), leaf ? (p.kind === "lawn" ? LAWN : LEAF) : undefined);
  }
  frontFrame(outside, data);
  arkadyGeometry(outside, data);
  pavilionGeometry(outside, data);
  parkingOutside(outside, data);
  p2Outside(outside, data);
  frontSignLetters(tiers, data);
  greenSlope(tiers, data);
  unitSigns(inside, data);
  ceilingLights(inside, data);
  escalatorGeometry(inside, data);
  return { outside, inside, tiers };
};
