import type { Vec3 } from "@seki/core";
import { type AlchemiaGarland, SQUARE_GARLANDS, garlandAt } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";

/**
 * The garlands of coloured lights over T0's square (ADR-0074 stage 7, the user's request 7.11): a
 * wire sagging from a pergola's corner to another's (`SQUARE_GARLANDS`), with a bulb under it every
 * `EVERY` metres in the kit's glow colours, so they shine at night by themselves. Into Alchemia's
 * outside sink: one mesh with the rest of it, no draw call of their own. Pure data, no Babylon.
 */

/** A metre of wire per segment, a bulb every this many metres, the bulbs' colours in turn. */
const SEGMENT = 1;
export const EVERY = 0.6;
const BULB = 0.09;
const HANG = 0.07;
export const BULB_COLOURS: readonly string[] = ["neon-pink", "neon-amber", "neon-cyan", "neon-green", "neon-violet"];

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

const span = (g: AlchemiaGarland): number => Math.hypot(g.to.x - g.from.x, g.to.z - g.from.z);

/** The bulbs of a garland: where each hangs and its colour's index, in turn along the wire. */
export const garlandBulbs = (g: AlchemiaGarland): { readonly at: Vec3; readonly colour: number }[] => {
  const n = Math.max(1, Math.floor(span(g) / EVERY));
  return Array.from({ length: n - 1 }, (_, k) => {
    const p = garlandAt(g, (k + 1) / n);
    return { at: { ...p, y: p.y - HANG }, colour: k % BULB_COLOURS.length };
  });
};

/** The garlands' wires and bulbs into `sink`. */
export const garlandsGeometry = (sink: GeometrySink, data: CityKitData, garlands: readonly AlchemiaGarland[] = SQUARE_GARLANDS): void => {
  const wire = swatchUv(data, "cable");
  const colours = BULB_COLOURS.map((c) => swatchUv(data, c));
  for (const g of garlands) {
    const n = Math.max(1, Math.ceil(span(g) / SEGMENT));
    let prev = garlandAt(g, 0);
    for (let i = 1; i <= n; i++) {
      const p = garlandAt(g, i / n);
      const dir = unit(sub(p, prev));
      const side = unit(cross(dir, Y));
      const up = cross(side, dir);
      const mid = { x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2, z: (p.z + prev.z) / 2 };
      sink.box(mid, [side, up, dir], [0.012, 0.012, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) / 2 + 0.01], wire);
      prev = p;
    }
    for (const b of garlandBulbs(g)) sink.box(b.at, [X, Y, Z], [BULB / 2, BULB / 2, BULB / 2], colours[b.colour]!);
  }
};
