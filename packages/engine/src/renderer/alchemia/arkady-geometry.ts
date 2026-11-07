import type { Vec3 } from "@seki/core";
import { ARKADY, ARKADY_FRAME, ARKADY_PIECES, ARKADY_RESTAURANTS, type AlchemiaBox, type AlchemiaPiece, arkadyPoint, arkadySpanMid } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";

/**
 * The Arkady rebuilt (ADR-0074 stage 2) as pieces of geometry on the city kit's texture, in the
 * outside sink of Alchemia (`alchemia-geometry.ts`): the simulation's boxes of the building's own
 * frame (`ARKADY_PIECES`, askew of the world's axes) turned into the world, coloured by their kind
 * and place, and what only the eye needs: the restaurants' signs over their doors in the arcade
 * (proper names, drawn without words) and the warm light strips under the arcade's ceiling. Pure
 * data, no Babylon.
 */

const Y: Vec3 = { x: 0, y: 1, z: 0 };
const ALONG: Vec3 = { x: ARKADY_FRAME.along.x, y: 0, z: ARKADY_FRAME.along.z };
const ACROSS: Vec3 = { x: ARKADY_FRAME.across.x, y: 0, z: ARKADY_FRAME.across.z };

/** A box of the building's frame (x along it, z across it) in the sink. */
export const arkadyBox = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string): void => {
  const c = arkadyPoint((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  sink.box({ x: c.x, y: (b.y0 + b.y1) / 2, z: c.z }, [ALONG, Y, ACROSS], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch));
};

/** The restaurants' neon by their kitchen: the kit's glow swatches. */
const SIGN: Readonly<Record<string, string>> = { polish: "neon-amber", italian: "neon-green", wine: "neon-violet" };

/**
 * A piece's swatch: plastered walls over brick arches and piers (the inter-war jatki, S6), the
 * restaurants' fronts lit warm, the upper floor's windows lit in two of three spans (the rest dark),
 * the pavements and the arcade's floor in paving.
 */
const swatchOf = (p: AlchemiaPiece): string => {
  const b = p.box;
  switch (p.kind) {
    case "wall":
      return b.y1 <= ARKADY.upper && b.z1 - b.z0 <= ARKADY.pier + 0.01 ? "brick" : "wall";
    case "glass": {
      if (b.y0 < ARKADY.upper) return "shop-warm";
      const k = Math.floor((b.x0 + b.x1) / 2 / (ARKADY.length / ARKADY.spans));
      return k % 3 === 1 ? "glass-dark" : "win-warm";
    }
    case "frame":
      return "door";
    case "step":
      return "trim-light";
    case "parapet":
      return "trim";
    default:
      return "roof";
  }
};

/** The signs over the restaurants' doors at the back of the arcade, and the light strips under its ceiling. */
const arcadeDress = (sink: GeometrySink, data: CityKitData): void => {
  const crown = ARKADY.ground + ARKADY.clear;
  for (const r of ARKADY_RESTAURANTS) {
    const m = arkadySpanMid(r.door);
    arkadyBox(sink, data, { x0: m - 1.1, x1: m + 1.1, z0: ARKADY.arcade - 0.1, z1: ARKADY.arcade - 0.04, y0: ARKADY.ground + 2.5, y1: ARKADY.ground + 2.75 }, SIGN[r.cuisine] ?? "neon-cyan");
  }
  const span = ARKADY.length / ARKADY.spans;
  arkadyBox(sink, data, { x0: span + 0.5, x1: ARKADY.length - 1, z0: ARKADY.arcade / 2 - 0.12, z1: ARKADY.arcade / 2 + 0.12, y0: ARKADY.upper - 0.45, y1: ARKADY.upper - 0.37 }, "win-warm");
  // The arches' underside, so the band over the spans reads as arches from below.
  arkadyBox(sink, data, { x0: span, x1: ARKADY.length, z0: 0.02, z1: ARKADY.pier - 0.02, y0: crown - 0.02, y1: crown }, "trim");
};

/** The Arkady into Alchemia's outside sink. */
export const arkadyGeometry = (sink: GeometrySink, data: CityKitData, pieces: readonly AlchemiaPiece[] = ARKADY_PIECES): void => {
  for (const p of pieces) arkadyBox(sink, data, p.box, swatchOf(p));
  arcadeDress(sink, data);
};
