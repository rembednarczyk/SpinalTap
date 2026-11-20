import { FRONT_SIGN, L2_TOP } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import { FRONT_HOLOS, HOLO_Z, SIGN_FRAME } from "./front-signs";

/*
 * The bodies of the front's light (ADR-0074 C4) in the tiers' mesh, on the city kit's material: the
 * sign's lightbox, a box 0.4 m deep with a pale metal frame proud of its face and a strip of light
 * along its top (the board's cyan line over the letters), and the holograms' emitters on L2's
 * terrace: a housing with its strip of light, two thin posts and a bar over the panel. The light
 * itself (the face's glow, the letters, the holograms) is the signs' mesh (`front-signs.ts`).
 */

type Span = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly y0: number; readonly y1: number };

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const Z = { x: 0, y: 0, z: 1 };

const boxOf = (sink: GeometrySink, data: CityKitData, b: Span, swatch: string): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch));
};

/** How far the frame stands proud of the face. */
const PROUD = 0.06;

/** The sign's lightbox: its body, its pale frame and the strip of light along its top. */
const lightbox = (sink: GeometrySink, data: CityKitData): void => {
  const b = FRONT_SIGN;
  const F = SIGN_FRAME;
  boxOf(sink, data, b, "metal");
  const z = { z0: b.z0 - PROUD, z1: b.z0 + 0.02 };
  boxOf(sink, data, { ...b, ...z, y0: b.y1 - F, y1: b.y1 }, "ac");
  boxOf(sink, data, { ...b, ...z, y0: b.y0, y1: b.y0 + F }, "ac");
  boxOf(sink, data, { ...b, ...z, x1: b.x0 + F, y0: b.y0 + F, y1: b.y1 - F }, "ac");
  boxOf(sink, data, { ...b, ...z, x0: b.x1 - F, y0: b.y0 + F, y1: b.y1 - F }, "ac");
  boxOf(sink, data, { ...b, z0: b.z0 - PROUD - 0.03, z1: b.z0 - PROUD, y0: b.y1 - 0.11, y1: b.y1 - 0.03 }, "neon-cyan");
};

/** A hologram's emitter: the housing on the terrace, the posts up its sides and the bar over it. */
const emitter = (sink: GeometrySink, data: CityKitData, o: (typeof FRONT_HOLOS)[number], strip: string): void => {
  const z = HOLO_Z;
  boxOf(sink, data, { x0: o.x0 - 0.15, x1: o.x1 + 0.15, z0: z - 0.2, z1: z + 0.3, y0: L2_TOP, y1: o.y0 - 0.05 }, "metal");
  boxOf(sink, data, { x0: o.x0 - 0.1, x1: o.x1 + 0.1, z0: z - 0.23, z1: z - 0.2, y0: o.y0 - 0.2, y1: o.y0 - 0.1 }, strip);
  for (const x of [o.x0 - 0.09, o.x1 + 0.09]) boxOf(sink, data, { x0: x - 0.04, x1: x + 0.04, z0: z + 0.08, z1: z + 0.16, y0: o.y0 - 0.05, y1: o.y1 + 0.1 }, "metal");
  boxOf(sink, data, { x0: o.x0 - 0.13, x1: o.x1 + 0.13, z0: z + 0.04, z1: z + 0.2, y0: o.y1 + 0.02, y1: o.y1 + 0.12 }, "dark");
};

/** The sign's lightbox and the holograms' emitters, into the tiers' sink. */
export const frontSignGeometry = (sink: GeometrySink, data: CityKitData): void => {
  lightbox(sink, data);
  FRONT_HOLOS.forEach((o, i) => emitter(sink, data, o, i === 0 ? "neon-pink" : "neon-cyan"));
};
