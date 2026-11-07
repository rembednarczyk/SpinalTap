import type { Vec3 } from "@seki/core";
import { ALCHEMIA_PIECES, ALCHEMIA_UNITS, type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, FOODHALL, FOODHALL_INNER, FRONT_OPENINGS } from "@seki/sim";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { arkadyGeometry } from "./arkady-geometry";
import { pavilionGeometry } from "./pavilion-geometry";
import { parkingOutside } from "./parking-geometry";

/**
 * Alchemia by the investor's plan (ADR-0074 stage 1) as pieces of geometry on the city kit's
 * texture: the simulation's boxes (`ALCHEMIA_PIECES`) coloured by their kind, and what only the
 * eye needs: the front's frame, the units' signs (proper names, drawn without words), the ceiling's
 * light strips. Two sinks: outside (the shell, the green roof, the lift's kiosk, the terraces'
 * steps, T2 with its stairs and the Arkady of stage 2, the pavilion on the corner of stage 3, P-1's ramp trench and stair house of stage 4,
 * T0's pergolas with their paper lanterns, the beds and the roof's lawns of stage 7), drawn from afar, and inside (units, counters, tables, the stairs, the lights), drawn near
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

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch));
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

/** The ceiling's light strips over the tables and the aisles: warm (ADR-0074 §6). */
const ceilingLights = (sink: GeometrySink, data: CityKitData): void => {
  const I = FOODHALL_INNER;
  const y = FOODHALL.ceiling - 0.04;
  for (let z = 40; z < 50; z += 3) boxOf(sink, data, { x0: I.minX + 9, x1: I.maxX - 9, z0: z, z1: z + 0.25, y0: y - 0.06, y1: y }, "win-warm");
};

export interface AlchemiaSinks {
  readonly outside: GeometrySink;
  readonly inside: GeometrySink;
}

/** Alchemia's two sinks from the simulation's pieces. */
export const alchemiaGeometry = (data: CityKitData, pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES): AlchemiaSinks => {
  const outside = new GeometrySink();
  const inside = new GeometrySink();
  for (const p of pieces) {
    const sink = p.inside ? inside : outside;
    const b = p.box;
    // The front's glass: lit warm from the floor to a hand over the doors, a dark band over it to the ceiling.
    if (p.kind === "glass" && b.x1 - b.x0 >= 0.3 && b.z0 >= FOODHALL.maxZ - FOODHALL.wall - 0.01 && b.y1 - b.y0 > 1) {
      const lit = Math.min(b.y1, FOODHALL.floor + LIT_GLASS);
      if (lit > b.y0) boxOf(sink, data, { ...b, y1: lit }, "win-warm");
      if (b.y1 > lit) boxOf(sink, data, { ...b, y0: Math.max(b.y0, lit) }, "glass-dark");
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
    boxOf(sink, data, b, swatchOf(p));
  }
  frontFrame(outside, data);
  arkadyGeometry(outside, data);
  pavilionGeometry(outside, data);
  parkingOutside(outside, data);
  unitSigns(inside, data);
  ceilingLights(inside, data);
  return { outside, inside };
};
