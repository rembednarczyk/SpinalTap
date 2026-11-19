import { P1_RAMP, p1RampY } from "./parking";
import { type Piece, box, piece } from "./plan";
import { FOUNTAIN, FRONT_KIOSKS, L2_TOP, L3, L3_TOP } from "./front";
import { groundY } from "../lublin/terrain";

/*
 * The board's details on the front (ADR-0074 B4, decisions of 19.11): umbrellas over tables on L3's roof, tall
 * screens on L3's sides and the ramp's portal lit green, as on the board. Drawn only: nobody climbs
 * to L2's terrace or L3's roof (no stairs lead there), and the ramp's lights are in its walls.
 */

/** Umbrellas over tables on L3's roof, towards its south edge: the board's top terrace. */
const umbrellas = (): Piece[] =>
  [L3.minX + 4, L3.minX + 10, L3.minX + 16, L3.minX + 22].flatMap((x, i) => {
    const z = L3.minZ + 3 + (i % 2) * 1.5;
    return [
      piece(box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, L3_TOP, L3_TOP + 0.75), "table", false, false),
      piece(box(x - 0.04, x + 0.04, z - 0.04, z + 0.04, L3_TOP + 0.75, L3_TOP + 2.3), "column", false, false),
      piece(box(x - 1.3, x + 1.3, z - 1.3, z + 1.3, L3_TOP + 2.3, L3_TOP + 2.45), "umbrella", false, false),
    ];
  });

/** Tall screens on L3's west and east faces, the board's billboards on the top storey. */
const sideScreens = (): Piece[] => [
  piece(box(L3.minX - 0.06, L3.minX, L3.minZ + 3, L3.minZ + 7, L2_TOP + 0.6, L3_TOP - 0.6), "screen", false, false),
  piece(box(L3.maxX, L3.maxX + 0.06, L3.minZ + 3, L3.minZ + 7, L2_TOP + 0.6, L3_TOP - 0.6), "screen", false, false),
];

/** The ramp's portal lit green: strips along both walls a metre over the ramp, and a band over its mouth under L2. */
const rampLights = (): Piece[] => {
  const r = P1_RAMP;
  const out: Piece[] = [];
  for (let z = r.top + 1; z < r.covered + 6; z += 2) {
    const y = p1RampY(z + 1) + 0.9;
    out.push(piece(box(r.minX + 0.01, r.minX + 0.05, z, z + 2, y, y + 0.06), "led-green", false, false));
    out.push(piece(box(r.maxX - 0.05, r.maxX - 0.01, z, z + 2, y, y + 0.06), "led-green", false, false));
  }
  // On the portal beam's face over the trench (its underside the ramp's headroom over the ramp at the cover's start).
  const beam = p1RampY(r.covered) + r.headroom;
  out.push(piece(box(r.minX + 0.2, r.maxX - 0.2, r.covered - 0.36, r.covered - 0.3, beam + 0.12, beam + 0.24), "led-green", false, false));
  return out;
};

/**
 * The fountain on the square before the west wing (the board's, with its hologram): a basin knee
 * high of four solid walls, its water, and over it a figure of light in stacked rings round a core.
 */
const fountain = (): Piece[] => {
  const f = FOUNTAIN;
  const cx = (f.minX + f.maxX) / 2;
  const cz = (f.minZ + f.maxZ) / 2;
  const low = Math.min(groundY(f.minX, f.minZ), groundY(f.maxX, f.minZ), groundY(f.minX, f.maxZ), groundY(f.maxX, f.maxZ));
  const top = Math.max(groundY(f.minX, f.minZ), groundY(f.maxX, f.minZ), groundY(f.minX, f.maxZ), groundY(f.maxX, f.maxZ)) + 0.5;
  const T = 0.25;
  const out: Piece[] = [
    piece(box(f.minX, f.maxX, f.minZ, f.minZ + T, low - 0.2, top), "parapet", false),
    piece(box(f.minX, f.maxX, f.maxZ - T, f.maxZ, low - 0.2, top), "parapet", false),
    piece(box(f.minX, f.minX + T, f.minZ + T, f.maxZ - T, low - 0.2, top), "parapet", false),
    piece(box(f.maxX - T, f.maxX, f.minZ + T, f.maxZ - T, low - 0.2, top), "parapet", false),
    piece(box(f.minX + T, f.maxX - T, f.minZ + T, f.maxZ - T, low - 0.2, top - 0.12), "water", false),
    piece(box(cx - 0.06, cx + 0.06, cz - 0.06, cz + 0.06, top - 0.12, top + 2.4), "led", false, false),
  ];
  for (let k = 0; k < 5; k++) {
    const r = 0.55 - k * 0.07;
    const y = top + 0.4 + k * 0.42;
    out.push(piece(box(cx - r, cx + r, cz - r, cz + r, y, y + 0.03), "led", false, false));
  }
  return out;
};

/** A kiosk's height to its roof, its awning's reach over its counter, the lit window's band. */
const KIOSK = { height: 2.5, awning: 0.7, window: { y0: 1.0, y1: 1.9 } } as const;

/**
 * The kiosks before the front (the board's booths): a solid box standing on the slope's low side,
 * a lit window over the counter on the street's side, an awning over it, a strip of light round the
 * roof's edge. Solid: walkers go round them.
 */
const kiosks = (): Piece[] =>
  FRONT_KIOSKS.flatMap((k) => {
    const low = Math.min(groundY(k.minX, k.minZ), groundY(k.maxX, k.minZ), groundY(k.minX, k.maxZ), groundY(k.maxX, k.maxZ));
    const high = Math.max(groundY(k.minX, k.minZ), groundY(k.maxX, k.minZ), groundY(k.minX, k.maxZ), groundY(k.maxX, k.maxZ));
    const top = high + KIOSK.height;
    return [
      piece(box(k.minX, k.maxX, k.minZ, k.maxZ, low - 0.1, top), "wall", false),
      piece(box(k.minX - 0.1, k.maxX + 0.1, k.minZ - 0.1, k.maxZ + 0.1, top, top + 0.12), "roof", false),
      piece(box(k.minX + 0.2, k.maxX - 0.2, k.minZ - 0.03, k.minZ, high + KIOSK.window.y0, high + KIOSK.window.y1), "glass", false, false),
      piece(box(k.minX, k.maxX, k.minZ - KIOSK.awning, k.minZ, high + KIOSK.window.y1 + 0.1, high + KIOSK.window.y1 + 0.22), "umbrella", false, false),
      piece(box(k.minX - 0.12, k.maxX + 0.12, k.minZ - 0.12, k.maxZ + 0.12, top + 0.12, top + 0.18), "led", false, false),
    ];
  });

/** Every detail of B4 on the front. */
export const frontDressPieces = (): Piece[] => [...umbrellas(), ...sideScreens(), ...rampLights(), ...fountain(), ...kiosks()];
