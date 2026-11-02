/**
 * The facade shader's glass mask (`facadeDecode`, `facadeWindow`, `facadeGlass` in `npr/toon-city.ts`)
 * ported line by line, near the camera (detail 1): what the doors of ADR-0058 stage 9 are checked
 * against, by the slots' test (`door-slots.test.ts`) and the glitch scan (`door-pieces.ts`). Its
 * GLSL's text is pinned in `facade-glass-pin.test.ts`: a change there comes here, and to
 * `groundGlass` in `renderer/mapcity/door-slots.ts`.
 */

const fract = (v: number) => v - Math.floor(v);
const step = (e: number, x: number) => (x < e ? 0 : 1);

/**
 * The mask on a wall at `q` (metres along it, above the ground floor), from the wall's UV2 `meta`:
 * "pane", "gate" (the dark passage a tenement may have in its second bay, taken as painted whatever
 * the shader's hash says) or null. A church's lancets are taken as filling their cells.
 */
export const shaderGlass = (q: { x: number; y: number }, meta: readonly [number, number]): "pane" | "gate" | null => {
  const storey = Math.floor(meta[0] + 0.0005) / 10;
  const bay = Math.floor(fract(meta[0]) * 1000 + 0.5) / 100;
  const code = Math.floor(meta[1] + 0.0005);
  const seed = (Math.floor(fract(meta[1]) * 256) + 0.5) / 256;
  const shop = step(7.5, code) * (1 - step(15.5, code));
  const style = code - 8 * shop;
  if (storey < 0.05 || style > 15.5 || q.y < 0) return null;
  const ground = storey * 1.25;
  const church = step(3.5, style) * step(style, 4.5);
  if (q.y < ground && shop > 0.5 && church < 0.5) {
    const sb = bay * (fract(seed * 3.1) > 0.5 ? 1 : 2);
    const u = fract(q.x / sb);
    return step(0.05, u) * step(u, 0.95) * step(0.45, q.y) * step(q.y, ground - 0.85) > 0 ? "pane" : null;
  }
  const fy = q.y < ground ? q.y / ground : fract((q.y - ground) / storey);
  const c = Math.floor(q.x / bay);
  const u = fract(q.x / bay);
  if (q.y < ground && style < 1.5 && Math.abs(c - 1) <= 0.5) return step(0.16, u) * step(u, 0.84) * step(q.y, ground * 0.8) > 0 ? "gate" : null;
  const box = (u0: number, u1: number, f0: number, f1: number) => step(u0, u) * step(u, u1) * step(f0, fy) * step(fy, f1) > 0;
  const lit =
    style < 1.5 ? box(0.3, 0.7, 0.24, 0.8) : style < 2.5 ? box(0.1, 0.9, 0.25, 0.84) : style < 3.5 ? box(0.28, 0.72, 0.2, 0.86) : style < 4.5 ? true : style < 5.5 ? box(0.04, 0.96, 0.56, 0.8) : box(0.2, 0.8, 0.3, 0.76);
  return lit ? "pane" : null;
};
