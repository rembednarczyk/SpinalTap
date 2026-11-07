import type { Vec3 } from "@seki/core";
import { type AlchemiaBox, type AlchemiaPiece, type AlchemiaPieceKind, P1, P1_CABINS, P1_PIECES, P1_RAMP, P1_RAMP_GRADE, p1RampY } from "@seki/sim";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";

/**
 * P-1 under Alchemia's car park (ADR-0074 stage 4) as geometry on the city kit's texture: the
 * simulation's boxes (`P1_PIECES`) coloured by kind, the ramp's sloped surface with its lanes'
 * paint and its footway's kerb, and what only the eye needs: the ceiling's cold light strips,
 * the cabins' turntables and the deck's lettering of paint. What shows from the car park (the
 * ramp's trench with its parapets and surface, the stair core's house) goes to Alchemia's outside
 * sink; the room under the ground (its floors, ceilings, walls, cabins and fittings) to a sink of
 * its own, drawn near only. The cabins' shutters are the moving cars' (`parking-traffic.ts`).
 * Pure data, no Babylon.
 */

const SWATCH: Readonly<Partial<Record<AlchemiaPieceKind, string>>> = {
  wall: "wall-dark",
  roof: "trim",
  floor: "roof",
  parapet: "trim-light",
  step: "trim-light",
  column: "trim-light",
  marking: "trim-light",
  charger: "neon-green",
  machine: "metal",
};

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch));
};

/** The ramp's frame: down it (+z, falling by its grade) and square to its surface (up). */
const RUN = P1_RAMP.foot - P1_RAMP.top;
const LENGTH = Math.hypot(RUN, P1_RAMP_GRADE * RUN);
const ALONG: Vec3 = { x: 0, y: -P1_RAMP_GRADE / Math.hypot(1, P1_RAMP_GRADE), z: 1 / Math.hypot(1, P1_RAMP_GRADE) };
const UP: Vec3 = { x: 0, y: ALONG.z, z: -ALONG.y };

/** A box on the ramp: across from x0 to x1, along it from z0 to z1 (on the map), its top `lift` over the surface, `depth` deep. */
const onRamp = (sink: GeometrySink, data: CityKitData, x0: number, x1: number, z0: number, z1: number, lift: number, depth: number, swatch: string): void => {
  const mz = (z0 + z1) / 2;
  const off = lift - depth / 2;
  const centre = { x: (x0 + x1) / 2, y: p1RampY(mz) + UP.y * off, z: mz + UP.z * off };
  sink.box(centre, [X, UP, ALONG], [(x1 - x0) / 2, depth / 2, ((z1 - z0) / RUN) * (LENGTH / 2)], swatchUv(data, swatch));
};

/** The ramp: its surface, a dashed line between its lanes, the footway's kerb along the east wall. */
const ramp = (sink: GeometrySink, data: CityKitData): void => {
  const r = P1_RAMP;
  onRamp(sink, data, r.minX, r.maxX, r.top, r.foot, 0.005, 0.25, "roof");
  onRamp(sink, data, r.walk - 0.15, r.walk, r.top, r.foot, 0.15, 0.15, "trim-light");
  onRamp(sink, data, r.walk, r.maxX, r.top, r.foot, 0.15, 0.15, "trim");
  // The lanes' middle: a dash every 3 m.
  const mx = (r.minX + r.walk) / 2;
  for (let z = r.top + 1; z < r.foot - 1; z += 3) onRamp(sink, data, mx - 0.06, mx + 0.06, z, z + 1.5, 0.012, 0.01, "trim-light");
};

/** The ceiling's cold strips over the deck's aisle and over the apron. */
const ceilingLights = (sink: GeometrySink, data: CityKitData): void => {
  const y = P1.ceiling - 0.04;
  for (let z = 5; z < 22; z += 4) boxOf(sink, data, { x0: 401.2, x1: 402.8, z0: z, z1: z + 0.2, y0: y - 0.06, y1: y }, "office");
  for (let x = 405; x < 420; x += 4) boxOf(sink, data, { x0: x, x1: x + 1.6, z0: 28.4, z1: 28.6, y0: y - 0.06, y1: y }, "office");
};

/** The cabins inside: a turntable on the floor, a lit band over the doorway. */
const cabins = (sink: GeometrySink, data: CityKitData): void => {
  for (const c of P1_CABINS) {
    const mz = (c.minZ + c.maxZ) / 2;
    boxOf(sink, data, { x0: c.minX + 0.6, x1: c.maxX - 0.6, z0: mz - 1.2, z1: mz + 1.2, y0: P1.floor - 0.02, y1: P1.floor + 0.02 }, "metal");
    boxOf(sink, data, { x0: c.maxX, x1: c.maxX + 0.05, z0: c.minZ + 0.3, z1: c.maxZ - 0.3, y0: P1.floor + 2.35, y1: P1.floor + 2.5 }, "neon-amber");
  }
};

const swatchOf = (p: AlchemiaPiece): string => SWATCH[p.kind] ?? "wall-dark";

/** What shows of P-1 from the car park, into Alchemia's outside sink: the trench with its ramp and parapets, the stair house. */
export const parkingOutside = (outside: GeometrySink, data: CityKitData, pieces: readonly AlchemiaPiece[] = P1_PIECES): void => {
  for (const p of pieces) if (!p.inside) boxOf(outside, data, p.box, swatchOf(p));
  ramp(outside, data);
};

/** The room under the ground: its own sink. */
export const parkingInside = (data: CityKitData, pieces: readonly AlchemiaPiece[] = P1_PIECES): GeometrySink => {
  const inside = new GeometrySink();
  for (const p of pieces) if (p.inside && p.kind !== "shutter") boxOf(inside, data, p.box, swatchOf(p));
  ceilingLights(inside, data);
  cabins(inside, data);
  return inside;
};
