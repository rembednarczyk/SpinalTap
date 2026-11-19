import type { Vec3 } from "@seki/core";
import { type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, P2_CUTTING, P2_CUTTING_PIECES, P2_SHELL_PIECES, P2_STORE_PIECES, SHELTER_HATCH_PIECES, SHELTER_PIECES } from "@seki/sim";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";

/**
 * P-2 under Alchemia's P-1 (ADR-0074 stage 5a) as geometry on the city kit's texture: the
 * simulation's boxes coloured by kind. The store and its corridor under the ground (`P2_SHELL_PIECES`,
 * `P2_STORE_PIECES`) go to a sink of their own, drawn near only; the portal's parapet and the
 * cutting in the slope (`P2_CUTTING_PIECES`) to Alchemia's outside sink, seen from T1 and T2. The
 * flight down from P-1 is drawn with P-1 (`P1_ALL_PIECES`). Half-dark (§6): dark concrete, the
 * racks' steel, the orange beacons in the kit's glowing amber. Pure data, no Babylon.
 */

const SWATCH: Readonly<Partial<Record<AlchemiaPieceKind, string>>> = {
  wall: "wall-dark",
  roof: "trim",
  floor: "roof",
  parapet: "trim-light",
  rack: "metal",
  pallet: "trim-light",
  glass: "glass-dark",
  tyre: "tyre",
  rail: "metal",
  beacon: "neon-amber",
  machine: "metal",
  marking: "fabric-amber",
  // The shelter (stage 5d1): its wartime benches' timber, the cases' frames and glass, the photographs, the hatch's steel.
  bench: "door",
  column: "trim",
  counter: "dark",
  screen: "trim-light",
  step: "trim",
  shutter: "metal",
};

/** The cars' paint, one of these by where the car stands (fixed: nothing of it is random). */
const PAINT = ["fabric-teal", "glass-blue", "fabric-magenta", "metal", "brick", "fabric-amber", "dumpster", "trim-light"] as const;

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch));
};

const swatchOf = (p: AlchemiaPiece): string => {
  if (p.kind === "car") return PAINT[Math.abs(Math.round(p.box.x0 * 3 + p.box.z0 * 7)) % PAINT.length]!;
  return SWATCH[p.kind] ?? "wall-dark";
};

/** The cutting's railing over its walls (B4, 19.11): its height, a post's side, the rails' thickness. */
export const RAILING = 1.0;
const POST = 0.06;
const BAR = 0.05;

/** A wall of the cutting or the portal's parapet across it: a metre of railing over it, not a solid parapet. */
export const isRailed = (b: AlchemiaBox): boolean => b.z0 >= P2_CUTTING.minZ - 1.5 && Math.max(b.x1 - b.x0, b.z1 - b.z0) > 1 && Math.min(b.x1 - b.x0, b.z1 - b.z0) < 0.5;

/**
 * A wall of the cutting drawn up to the slope beside it with a railing on it: posts at its ends, a
 * top rail and a middle one. Seen from T1 the cutting reads as a balustrade over a slope, not a long
 * grey wall hiding T2 (the look at P-2 of 19.11). The simulation keeps its solid parapet.
 */
const railedWall = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const top = b.y1 - RAILING;
  boxOf(sink, data, { ...b, y1: top }, SWATCH.parapet ?? "trim-light");
  const alongZ = b.z1 - b.z0 > b.x1 - b.x0;
  const mx = (b.x0 + b.x1) / 2;
  const mz = (b.z0 + b.z1) / 2;
  const ends = alongZ ? [b.z0 + POST, b.z1 - POST] : [b.x0 + POST, b.x1 - POST];
  for (const e of ends) {
    const [x, z] = alongZ ? [mx, e] : [e, mz];
    boxOf(sink, data, { x0: x - POST / 2, x1: x + POST / 2, z0: z - POST / 2, z1: z + POST / 2, y0: top, y1: b.y1 }, "metal");
  }
  for (const y of [b.y1 - BAR, top + RAILING / 2]) {
    const rail = alongZ ? { x0: mx - BAR / 2, x1: mx + BAR / 2, z0: b.z0, z1: b.z1 } : { x0: b.x0, x1: b.x1, z0: mz - BAR / 2, z1: mz + BAR / 2 };
    boxOf(sink, data, { ...rail, y0: y - BAR / 2, y1: y + BAR / 2 }, "metal");
  }
};

/** The portal's parapet and the cutting, the shelter's hatch with its shaft (stage 5d1), into Alchemia's outside sink. */
export const p2Outside = (outside: GeometrySink, data: CityKitData, pieces: readonly AlchemiaPiece[] = [...P2_CUTTING_PIECES, ...SHELTER_HATCH_PIECES]): void => {
  for (const p of pieces) {
    if (p.kind === "parapet" && isRailed(p.box)) railedWall(outside, data, p.box);
    else boxOf(outside, data, p.box, swatchOf(p));
  }
};

/** The store, the corridor and the shelter (stage 5d1) under the ground: their own sink. */
export const p2Inside = (data: CityKitData, pieces: readonly AlchemiaPiece[] = [...P2_SHELL_PIECES, ...P2_STORE_PIECES, ...SHELTER_PIECES]): GeometrySink => {
  const inside = new GeometrySink();
  for (const p of pieces) boxOf(inside, data, p.box, swatchOf(p));
  return inside;
};
