import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { type Piece, type PieceKind, box, piece } from "./plan";
import { shopHash } from "./shop-fittings";

/*
 * The front's rooms' fittings (ADR-0093 O5, `docs/zasady-lokacji.md` §2-§5): small builders for the
 * arcades, the café and the bar, in the world's axes on a floor `y`. What stops a body at its height is
 * solid (tables, benches, stools, counters, shelves); what is on them or over the head is drawn only.
 * Deterministic: a hash of the place (`shopHash`), never `Math.random`.
 */

/** A drawn piece inside (near only), solid when `solid`. */
export const inBox = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, kind: PieceKind, solid = false): Piece => piece(box(x0, x1, z0, z1, y0, y1), kind, true, solid);

/** The solids not drawn (a fixture drawn as its parts): kept apart from the drawn pieces by `drawnOnly`. */
const HIDDEN = new WeakSet<Piece>();
export const solidOnly = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Piece => {
  const p = piece(box(x0, x1, z0, z1, y0, y1), "machine", true, true);
  HIDDEN.add(p);
  return p;
};

/** One of the game's models on the floor `y` at (x, z), facing `yaw`. */
export const model = (prop: StreetPropKind, x: number, y: number, z: number, yaw: number, variant = 0): StreetPropItem => ({ prop, x, y, z, yaw, variant });

/** A cup on a top at `top`, steaming when somebody just left it (§5). */
export const cupAt = (x: number, z: number, top: number, hot: boolean): Piece[] => [
  inBox(x - 0.04, x + 0.04, z - 0.04, z + 0.04, top, top + 0.11, "cup"),
  ...(hot ? [inBox(x - 0.01, x + 0.02, z - 0.015, z + 0.015, top + 0.14, top + 0.3, "steam"), inBox(x + 0.01, x + 0.035, z - 0.01, z + 0.015, top + 0.3, top + 0.42, "steam")] : []),
];

/** Flyers, wrappers and cans on the floor round (x, z), `n` of them by the hash of `key`. */
export const litterAt = (key: string, x: number, z: number, y: number, n: number): Piece[] =>
  Array.from({ length: n }, (_, i) => {
    const g = shopHash(key, i, 1);
    const [u, v] = [x + (g - 0.5) * 1.4, z + (shopHash(key, i, 2) - 0.5) * 1.0];
    return inBox(u - 0.1, u + 0.1, v - 0.14, v + 0.14, y + 0.003, y + 0.008, i % 3 === 2 ? "goods" : "paper");
  });

/** Cartons stacked on the floor at (x, z), `n` high. */
export const cartonsAt = (key: string, x: number, z: number, y: number, n: number): Piece[] => {
  const out: Piece[] = [];
  let top = y;
  for (let i = 0; i < n; i++) {
    const g = shopHash(key, i, 3);
    const h = 0.25 + g * 0.2;
    const half = 0.22 + g * 0.14;
    out.push(inBox(x - half, x + half, z - half * 0.8, z + half * 0.8, top, top + h, "carton"));
    top += h;
  }
  return out;
};

/**
 * The services under a ceiling `c` along a run from (x0, z0) to (x1, z1) (along x or z): a pipe, a
 * cable tray and a sagging bundle of cables, a strip of light every `lamps` metres (none at 0).
 */
export const servicesRun = (x0: number, x1: number, z0: number, z1: number, c: number, lamps: number): Piece[] => {
  const alongX = x1 - x0 >= z1 - z0;
  const mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
  const span = (a: number, b: number, off: number, y0: number, y1: number, kind: PieceKind): Piece =>
    alongX ? inBox(a, b, mid + off - 0.07, mid + off + 0.07, y0, y1, kind) : inBox(mid + off - 0.07, mid + off + 0.07, a, b, y0, y1, kind);
  const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
  const out: Piece[] = [span(a0, a1, -0.9, c - 0.34, c - 0.2, "pipe"), span(a0, a1, 0.9, c - 0.12, c - 0.06, "cable"), span(a0, a1, 0.6, c - 0.22, c - 0.17, "cable")];
  if (lamps > 0) for (let a = a0 + lamps / 2; a < a1 - 0.5; a += lamps) out.push(span(a - 0.6, a + 0.6, 0, c - 0.07, c - 0.02, "lamp"));
  return out;
};

/** Green strips of light in the floor along a way (§4: green is for ways and doors), dashed, from (x0, z0) to (x1, z1). */
export const wayLights = (x0: number, x1: number, z0: number, z1: number, y: number): Piece[] => {
  const alongX = x1 - x0 >= z1 - z0;
  const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
  const out: Piece[] = [];
  for (let a = a0; a < a1 - 0.3; a += 2) {
    const b = Math.min(a + 1.2, a1);
    out.push(alongX ? inBox(a, b, z0 - 0.06, z0 + 0.06, y + 0.002, y + 0.012, "led-green") : inBox(x0 - 0.06, x0 + 0.06, a, b, y + 0.002, y + 0.012, "led-green"));
  }
  return out;
};

/** A café table at (x, z): its top on a column, a chair on each side of `chairs` (seat solid, back drawn); a cup on it, steaming when `hot`. */
export const cafeTable = (x: number, z: number, y: number, chairs: readonly ("x-" | "x+" | "z-" | "z+")[], hot: boolean): Piece[] => {
  const out: Piece[] = [inBox(x - 0.4, x + 0.4, z - 0.4, z + 0.4, y + 0.72, y + 0.76, "table", false), inBox(x - 0.06, x + 0.06, z - 0.06, z + 0.06, y, y + 0.72, "table", false)];
  // The table's solid: its top's footprint to its height.
  out.push(solidOnly(x - 0.4, x + 0.4, z - 0.4, z + 0.4, y - 0.05, y + 0.76));
  for (const c of chairs) {
    const [dx, dz] = c === "x-" ? [-1, 0] : c === "x+" ? [1, 0] : c === "z-" ? [0, -1] : [0, 1];
    const [cx, cz] = [x + dx * 0.62, z + dz * 0.62];
    out.push(inBox(cx - 0.2, cx + 0.2, cz - 0.2, cz + 0.2, y + 0.41, y + 0.45, "chair"), solidOnly(cx - 0.2, cx + 0.2, cz - 0.2, cz + 0.2, y - 0.05, y + 0.45));
    const [bx, bz] = [cx + dx * 0.19, cz + dz * 0.19];
    out.push(inBox(dx === 0 ? cx - 0.2 : bx - 0.02, dx === 0 ? cx + 0.2 : bx + 0.02, dz === 0 ? cz - 0.2 : bz - 0.02, dz === 0 ? cz + 0.2 : bz + 0.02, y + 0.45, y + 0.9, "chair"));
  }
  return [...out, ...cupAt(x + 0.12, z - 0.1, y + 0.76, hot)];
};

/** What of `pieces` the engine draws: all but the solids not drawn (`solidOnly`). */
export const drawnOnly = (pieces: readonly Piece[]): Piece[] => pieces.filter((p) => !HIDDEN.has(p));

/**
 * A bar along the inside of the glass facing out (ADR-0093 O5, the board's people at the lit glass): a
 * counter a hand off the glass from `x0` to `x1` on the floor `y`, its glass side a warm lightbox, stools
 * every 0.9 m on the room's side (`room` +1 north of the glass at `z`, -1 south), cups on it. Its seats
 * for still figures: `barSeats`.
 */
export const windowBar = (key: string, x0: number, x1: number, z: number, room: 1 | -1, y: number, ceiling: number): Piece[] => {
  const [c0, c1] = [z + room * 0.05, z + room * 0.5].sort((a, b) => a - b) as [number, number];
  const out: Piece[] = [
    inBox(x0, x1, c0, c1, y - 0.05, y + 1.05, "counter", true),
    inBox(x0 - 0.02, x1 + 0.02, c0 - 0.03, c1 + 0.03, y + 1.05, y + 1.09, "table"),
    // The lightbox on its glass side, seen from the street.
    room > 0 ? inBox(x0, x1, c0 - 0.03, c0, y + 0.1, y + 0.95, "lightbox") : inBox(x0, x1, c1, c1 + 0.03, y + 0.1, y + 0.95, "lightbox"),
  ];
  // Pendant lamps low over the counter and lit menu boards hung over it facing the glass: warm, the first thing the street sees.
  const mid = (c0 + c1) / 2;
  for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.0) out.push(inBox(x - 0.18, x + 0.18, mid - 0.18, mid + 0.18, y + 1.25, y + 1.65, "lantern"), inBox(x - 0.01, x + 0.01, mid - 0.01, mid + 0.01, y + 1.65, ceiling, "cable"));
  for (let x = x0 + 0.2; x + 1.8 <= x1; x += 2.0) {
    out.push(room > 0 ? inBox(x, x + 1.8, c0 + 0.2, c0 + 0.26, y + 1.72, y + 2.9, "lightbox") : inBox(x, x + 1.8, c1 - 0.26, c1 - 0.2, y + 1.72, y + 2.9, "lightbox"));
    out.push(inBox(x + 0.1, x + 0.12, c0 + 0.22, c0 + 0.24, y + 2.9, ceiling, "cable"), inBox(x + 1.68, x + 1.7, c0 + 0.22, c0 + 0.24, y + 2.9, ceiling, "cable"));
  }
  for (const s of barSeats(x0, x1, z, room)) {
    out.push(inBox(s.x - 0.17, s.x + 0.17, s.z - 0.17, s.z + 0.17, y + 0.71, y + 0.75, "bench"), inBox(s.x - 0.03, s.x + 0.03, s.z - 0.03, s.z + 0.03, y, y + 0.71, "bench"));
    out.push(solidOnly(s.x - 0.17, s.x + 0.17, s.z - 0.17, s.z + 0.17, y - 0.05, y + 0.75));
    if (shopHash(key, s.x * 10) < 0.45) out.push(...cupAt(s.x + 0.1, (c0 + c1) / 2, y + 1.09, shopHash(key, s.x, 2) < 0.4));
  }
  return out;
};

/** The stools of a window bar: every 0.9 m from its west end, 0.85 m off the glass into the room. */
export const barSeats = (x0: number, x1: number, z: number, room: 1 | -1): { x: number; z: number }[] => {
  const out: { x: number; z: number }[] = [];
  for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.9) out.push({ x, z: z + room * 0.85 });
  return out;
};
