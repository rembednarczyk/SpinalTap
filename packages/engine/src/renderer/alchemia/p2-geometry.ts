import type { Vec3 } from "@seki/core";
import { type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, P2_CUTTING_PIECES, P2_SHELL_PIECES, P2_STORE_PIECES } from "@seki/sim";
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

/** The portal's parapet and the cutting, into Alchemia's outside sink. */
export const p2Outside = (outside: GeometrySink, data: CityKitData, pieces: readonly AlchemiaPiece[] = P2_CUTTING_PIECES): void => {
  for (const p of pieces) boxOf(outside, data, p.box, swatchOf(p));
};

/** The store and the corridor under the ground: their own sink. */
export const p2Inside = (data: CityKitData, pieces: readonly AlchemiaPiece[] = [...P2_SHELL_PIECES, ...P2_STORE_PIECES]): GeometrySink => {
  const inside = new GeometrySink();
  for (const p of pieces) boxOf(inside, data, p.box, swatchOf(p));
  return inside;
};
