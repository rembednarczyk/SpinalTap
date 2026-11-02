import { describe, expect, it } from "vitest";
import { FACADE_GLSL } from "../src/npr/toon-city";

/**
 * The facade shader's glass mask (`facadeDecode`, `facadeWindow`, `facadeGlass` in `npr/toon-city.ts`)
 * has ports in TypeScript the doors are checked against (ADR-0058 stage 9): `groundGlass` in
 * `renderer/mapcity/door-slots.ts` and `shaderGlass` in `facade-glass-mask.ts` (the slots' test and
 * the glitch scan's `door-pieces.ts` and `decal-pieces.ts`), and the decals' rule of a wall without
 * glass, `glassFree` in `tools/osm-import/src/decal-walls.ts` (ADR-0058 stage 6: `facadeGlass`'s first
 * test of the storey). The GLSL's text is pinned here, so a change to the mask cannot leave them behind.
 */

/** A GLSL function's text from its signature to its closing brace. */
const glslFunction = (src: string, signature: string): string => {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`no ${signature} in FACADE_GLSL`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${signature} not closed`);
};

/** FNV-1a, 32 bits, of the text with its whitespace runs folded (reindenting is no change). */
const fnv = (text: string): string => {
  let h = 0x811c9dc5;
  for (const ch of text.replace(/\s+/g, " ")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};

describe("the facade shader's glass mask the doors and the decals are checked against", () => {
  it("is the one the TypeScript ports follow", () => {
    const pinned = ["void facadeDecode(", "float facadeWindow(", "vec4 facadeGlass("].map((s) => fnv(glslFunction(FACADE_GLSL, s)));
    expect(pinned, "the facade's glass mask changed: update groundGlass (door-slots.ts), shaderGlass (test/facade-glass-mask.ts) and glassFree (tools/osm-import/src/decal-walls.ts) to it, then these hashes").toEqual(["3c20ab3a", "f977ee7d", "30281b4c"]);
  });
});
