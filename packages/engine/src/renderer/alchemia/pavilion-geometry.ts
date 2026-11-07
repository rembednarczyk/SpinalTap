import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import { type PavilionLook, pavilionFaces } from "./pavilion-shape";

/**
 * The triangular pavilion (ADR-0074 stage 3) in Alchemia's outside mesh, on the city kit's
 * texture: its glass lit warm by the restaurant behind it (a lantern on the corner at night,
 * ADR-0074 §6), the dark frame and fascia, the roof and attic, the back-of-house box with its door,
 * the service ladder and the neon ALCHEMIA in the kit's glow swatch. Pure data, no Babylon.
 */

/** The kit's swatch of each look. */
const SWATCH: Readonly<Record<PavilionLook, string>> = {
  plinth: "wall-dark",
  glass: "shop-warm",
  "glass-top": "glass-dark",
  frame: "dark",
  fascia: "dark",
  roof: "roof",
  annex: "wall-dark",
  door: "door",
  attic: "trim-light",
  metal: "metal",
  board: "sign-back",
  neon: "neon-cyan",
};

/** The pavilion into Alchemia's outside sink. */
export const pavilionGeometry = (sink: GeometrySink, data: CityKitData): void => {
  const uv = Object.fromEntries(Object.entries(SWATCH).map(([k, s]) => [k, swatchUv(data, s)])) as Record<PavilionLook, readonly [number, number]>;
  pavilionFaces(([a, b, c, d], n, look) => sink.quad(a, b, c, d, n, uv[look]));
};
