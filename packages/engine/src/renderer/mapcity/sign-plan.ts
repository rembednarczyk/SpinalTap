import { prng } from "../city-kit-data";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { SIGN_OUT, SIGN_RADIUS, bracketSpots } from "./bracket-plan";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";
import { clearSpotFrom, clearStretches, fitFlatSign, wallNear } from "./sign-room";
import { type Uv, quadUv } from "./sink-ops";

/**
 * Neon of the map buildings (ADR-0044), one additive mesh per cell: boards over the shop
 * windows and blade signs from the Lublin atlas (Polish words with Japanese), neon tubes under
 * the cornices, holo-ads on the firewalls that rise over lower neighbours and on tall
 * buildings, lit name plaques on landmarks and the neon's streaks on the wet pavement.
 *
 * Encoding (map signs shader): uv = position on the quad (0..1, v up; for reflections v runs
 * from the wall outwards), uv2 = (atlas cell, holo seed or name slot; kind), colour rgb = tint,
 * a = brightness.
 */
export const MAP_SIGN_KIND = { board: 0, holo: 1, name: 2, tube: 3, reflection: 4, blade: 5, disc: 6, ad: 7, beam: 8, mist: 9, strobe: 10, venue: 11, glyph: 12 } as const;

/** Atlas: eight upright blades (1:4) across the top half, eight boards (4:1) below. */
export const MAP_SIGN_BLADES = ["APTEKA", "KAWA", "PIWO", "BAR", "24H", "HOTEL", "薬局", "ラーメン"] as const;
export const MAP_SIGN_BOARDS = ["CEBULARZE", "BAR MLECZNY", "KANTOR 両替", "ZAPIEKANKI", "RAMEN ラーメン", "LOMBARD", "PIEROGI 餃子", "KARAOKE カラオケ"] as const;

const NEON: readonly string[] = ["#ff2e88", "#00e5ff", "#ffb000", "#b46cff", "#39ff8a", "#ff4040"];

export const signTint = (hex: string, brightness: number): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, brightness];
};

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const UV_MIRROR: readonly [Uv, Uv, Uv, Uv] = [
  [1, 0],
  [0, 0],
  [0, 1],
  [1, 1],
];

/** A point on the wall: `u` metres from its start, at height y, `out` metres off it. */
const onWall = (w: Wall, u: number, y: number, out: number): Vec => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { x: w.a.x + dx * u + w.nx * out, y, z: w.a.z + dz * u + w.nz * out };
};

/** A quad flat on the wall, centred at (u, y). */
export const flatOnWall = (sink: MeshSink, w: Wall, u: number, y: number, out: number, width: number, height: number, color: Rgba, uv2: Uv): void => {
  quadUv(sink, [onWall(w, u - width / 2, y - height / 2, out), onWall(w, u + width / 2, y - height / 2, out), onWall(w, u + width / 2, y + height / 2, out), onWall(w, u - width / 2, y + height / 2, out)], { x: w.nx, y: 0, z: w.nz }, color, UV, uv2);
};

/** The drawn ground (terrain plus its pavement) at a point, or null outside the terrain. */
export type SignGround = (x: number, z: number) => number | null;

/** Above the drawn ground, so the streak never flickers into the pavement. */
const STREAK_LIFT = 0.02;

/**
 * Neon streak on the wet ground in front of a sign, from the wall `reach` metres out. Each
 * corner lies on the ground there: a building on a slope stands on a plinth, so its ground
 * floor (`fallback`) can be metres above the street in front of it.
 */
export const signReflection = (sink: MeshSink, w: Wall, u: number, ground: SignGround, fallback: number, width: number, reach: number, color: Rgba, seed: number): void => {
  const lay = (uu: number, out: number): Vec => {
    const p = onWall(w, uu, 0, out);
    return { x: p.x, y: (ground(p.x, p.z) ?? fallback) + STREAK_LIFT, z: p.z };
  };
  quadUv(sink, [lay(u - width / 2, 0.15), lay(u + width / 2, 0.15), lay(u + width / 2, reach), lay(u - width / 2, reach)], { x: 0, y: 1, z: 0 }, color, UV, [seed, MAP_SIGN_KIND.reflection]);
};

const BLADE_HEIGHT = 2.4;
/** How far the blade sign reaches out from the wall, from and to (metres). */
const BLADE_OUT = [0.25, 1.0] as const;

/** A blade sign sticking out of the wall at `u`: two faces back to back, both readable. */
const blade = (sink: MeshSink, w: Wall, u: number, y: number, cell: number, color: Rgba): void => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  const p = (out: number, yy: number, side: number): Vec => ({ x: w.a.x + dx * (u + side * 0.02) + w.nx * out, y: yy, z: w.a.z + dz * (u + side * 0.02) + w.nz * out });
  const h = BLADE_HEIGHT;
  const [o0, o1] = BLADE_OUT;
  const corners = (side: number) => [p(o0, y - h / 2, side), p(o1, y - h / 2, side), p(o1, y + h / 2, side), p(o0, y + h / 2, side)] as const;
  quadUv(sink, corners(1), { x: dx, y: 0, z: dz }, color, UV_MIRROR, [cell, MAP_SIGN_KIND.blade]);
  quadUv(sink, corners(-1), { x: -dx, y: 0, z: -dz }, color, UV, [cell, MAP_SIGN_KIND.blade]);
};

const streetWalls = (f: FacadeFrame): Wall[] =>
  f.walls
    .filter((w) => !w.blind && w.length >= 4)
    .slice()
    .sort((a, b) => b.length - a.length);

/**
 * Height of the shop board `shopSigns` may hang on this wall (its place along the wall is drawn
 * at random, so the whole wall counts), or null when the wall gets none (ADR-0058: the awnings).
 */
export const shopBoardOn = (f: FacadeFrame, w: Wall): number | null => {
  if (f.b.bracketSigns || f.b.venues?.length || f.style.signs <= 0 || !f.style.shopfront || (f.b.doorways?.length ?? 0) > 0) return null;
  return streetWalls(f).slice(0, f.style.signs).includes(w) ? shopBoardHeight(w) : null;
};

/** Lit name plaque under the cornice of the longest street wall (landmarks). */
const namePlaque = (sink: MeshSink, f: FacadeFrame, slot: number): void => {
  const w = streetWalls(f)[0];
  const name = f.b.name ?? "";
  if (!w) return;
  const width = Math.min(w.length * 0.8, 0.55 * name.length + 1.2);
  const h = width / 8;
  const y = f.style.tower ? f.b.base + Math.min(f.ground * 0.9, 7) : f.eave - 0.9 - h / 2;
  flatOnWall(sink, w, w.length / 2, y, 0.12, width, h, signTint("#fff1d6", 1), [slot, MAP_SIGN_KIND.name]);
};

/** Narrowest a holo-ad gets where a neighbour leaves less of the wall clear (G-157), metres. */
const HOLO_MIN = 3;

/** Holo-ads: on firewalls that rise over lower neighbours, and high on tall buildings. */
const holos = (sink: MeshSink, f: FacadeFrame, rand: () => number): void => {
  for (const w of f.walls) {
    if (!w.blind || hiddenWall(f, w) || w.length < 7) continue;
    const from = Math.max(w.coveredTo, f.b.base);
    const exposed = f.top - from;
    if (exposed < 7 || rand() > 0.7) continue;
    const color = signTint(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1);
    const seed = rand();
    // A neighbour taller than the one against the wall may stand out in front of its end (G-157).
    const bottom = from + exposed * 0.125;
    const width = Math.min(w.length * 0.7, 14);
    // A narrow wall's whole ad is narrower than HOLO_MIN: only a neighbour may leave it out (G-157).
    const fit = fitFlatSign(f, w, w.length / 2, width, Math.min(HOLO_MIN, width), 0.45, bottom);
    if (!fit) continue;
    const height = Math.min(exposed * 0.75, fit.width * 1.6);
    flatOnWall(sink, w, fit.u, from + exposed / 2, 0.45, fit.width, height, color, [seed, MAP_SIGN_KIND.holo]);
  }
  const w = streetWalls(f)[0];
  // A lifted part (G-049) has only its own walls to hang an ad on, not the building's under it.
  const tall = f.b.lifted ? f.top - f.b.foot : f.b.height;
  if (w && tall > 22 && rand() < 0.5) {
    const want = w.length * (0.3 + rand() * 0.4);
    const color = signTint(NEON[Math.floor(rand() * NEON.length)] ?? "#ff2e88", 1);
    const seed = rand();
    const width = Math.min(w.length * 0.5, 10);
    const bottom = f.top - 2 - Math.min(width * 1.4, tall * 0.4);
    const fit = fitFlatSign(f, w, want, width, Math.min(HOLO_MIN, width), 0.8, bottom);
    if (!fit) return;
    const height = Math.min(fit.width * 1.4, tall * 0.4);
    flatOnWall(sink, w, fit.u, f.top - height / 2 - 2, 0.8, fit.width, height, color, [seed, MAP_SIGN_KIND.holo]);
  }
};

/** Width of the shop board on a street wall (it depends on the wall only). */
export const shopBoardWidth = (w: Wall): number => Math.min(w.length * 0.55, 7);

/** Height of the shop board on a street wall, centred 0.45 m under the ground floor's top. */
export const shopBoardHeight = (w: Wall): number => Math.min(Math.max(shopBoardWidth(w) / 4, 0.6), 1.3);

/** Shop boards, blades and their reflections on the street walls. */
const shopSigns = (sink: MeshSink, f: FacadeFrame, rand: () => number, ground: SignGround): void => {
  const walls = streetWalls(f).slice(0, f.style.signs);
  const groundY = f.b.foot + 0.16;
  for (const w of walls) {
    const color = NEON[Math.floor(rand() * NEON.length)] ?? "#ff2e88";
    const width = shopBoardWidth(w);
    const h = shopBoardHeight(w);
    const u = width / 2 + 0.5 + rand() * Math.max(w.length - width - 1, 0);
    if (f.style.shopfront) {
      const cell = Math.floor(rand() * MAP_SIGN_BOARDS.length);
      flatOnWall(sink, w, u, f.b.base + f.ground - 0.45, 0.1, width, h, signTint(color, 1), [cell, MAP_SIGN_KIND.board]);
      signReflection(sink, w, u, ground, groundY, width * 0.9, 6, signTint(color, 0.8), rand());
    }
    if (rand() < 0.6) {
      const end = rand() < 0.5 ? 0.9 : w.length - 0.9;
      const bc = signTint(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1);
      const cell = Math.floor(rand() * MAP_SIGN_BLADES.length);
      const seed = rand();
      const y = f.b.base + f.ground + 1.7;
      // Off the end where a neighbour stands out in front of the wall (G-157), or none.
      const u = clearSpotFrom(f, w, end, w.length - end, BLADE_OUT[0], BLADE_OUT[1], y - BLADE_HEIGHT / 2);
      if (u === null) continue;
      blade(sink, w, u, y, cell, bc);
      signReflection(sink, w, u, ground, groundY, 1.4, 5, [bc[0], bc[1], bc[2], 0.6], seed);
    }
  }
};

/** Round neon signs hung from the Old Town's brackets, both faces along the street (ADR-0048). */
const bracketSigns = (sink: MeshSink, f: FacadeFrame, ground: SignGround): void => {
  for (const s of bracketSpots(f)) {
    const w = s.wall;
    const dx = (w.b.x - w.a.x) / w.length;
    const dz = (w.b.z - w.a.z) / w.length;
    const y = s.y - SIGN_RADIUS - 0.12;
    const color = signTint(NEON[Math.floor(s.seed * NEON.length) % NEON.length] ?? "#ffb000", 1);
    const corner = (out: number, yy: number, side: number): Vec => ({ x: w.a.x + dx * (s.u + side * 0.015) + w.nx * out, y: yy, z: w.a.z + dz * (s.u + side * 0.015) + w.nz * out });
    const face = (side: number) => [corner(SIGN_OUT - SIGN_RADIUS, y - SIGN_RADIUS, side), corner(SIGN_OUT + SIGN_RADIUS, y - SIGN_RADIUS, side), corner(SIGN_OUT + SIGN_RADIUS, y + SIGN_RADIUS, side), corner(SIGN_OUT - SIGN_RADIUS, y + SIGN_RADIUS, side)] as const;
    quadUv(sink, face(1), { x: dx, y: 0, z: dz }, color, UV_MIRROR, [s.seed * 8, MAP_SIGN_KIND.disc]);
    quadUv(sink, face(-1), { x: -dx, y: 0, z: -dz }, color, UV, [s.seed * 8, MAP_SIGN_KIND.disc]);
    signReflection(sink, w, s.u, ground, f.b.foot + 0.16, 1, 4, [color[0], color[1], color[2], 0.5], s.seed);
  }
};

/** The cornice tube: how far under the eave, how far off the wall and how thick, metres. */
const TUBE_UNDER_EAVE = 0.66;
const TUBE_OUT = 0.22;
const TUBE_HEIGHT = 0.09;
/** Shortest piece of tube a neighbour leaves on a wall (G-170), metres; a short wall left whole keeps its own. */
const TUBE_MIN = 1;

/**
 * Neon tube under the main cornice along every street wall, on the stretches of it a neighbour
 * standing out in front of the wall leaves clear (G-170); a cut piece shorter than TUBE_MIN is left out.
 */
const tubes = (sink: MeshSink, f: FacadeFrame, color: string): void => {
  const y = f.eave - TUBE_UNDER_EAVE;
  for (const w of f.walls) {
    if (hiddenWall(f, w) || w.blind) continue;
    // Looking every 0.1 m of every wall up took most of the signs' time: only near the neighbours now.
    for (const [a, b] of clearStretches(f, w, TUBE_OUT, TUBE_OUT, y - TUBE_HEIGHT / 2, wallNear(f, w, TUBE_OUT))) {
      if (b - a >= Math.min(TUBE_MIN, w.length)) flatOnWall(sink, w, (a + b) / 2, y, TUBE_OUT, b - a, TUBE_HEIGHT, signTint(color, 1), [0, MAP_SIGN_KIND.tube]);
    }
  }
};

/**
 * Signs of one building. `nameSlot` gives the plaque's row in the names atlas (null: no room);
 * `ground` is where the neon's streaks lie (without it, the outline's lowest ground).
 */
export const planBuildingSigns = (sink: MeshSink, f: FacadeFrame, nameSlot: (name: string) => number | null, ground: SignGround = () => null): void => {
  const rand = prng((f.b.look ^ 0x5191) >>> 0);
  // A room or a gate the game cut into the building (ADR-0045) carries the game's own sign there.
  if (f.b.bracketSigns) bracketSigns(sink, f, ground);
  // The map's own venues (ADR-0064 stage 4) sign the building instead of the atlas's boards (`planVenueSigns`).
  else if (f.style.signs > 0 && !(f.b.doorways && f.b.doorways.length > 0) && !f.b.venues?.length) shopSigns(sink, f, rand, ground);
  if (f.style.neonTrim && f.style.cornice) tubes(sink, f, f.style.neonTrim);
  holos(sink, f, rand);
  if (f.b.name) {
    const slot = nameSlot(f.b.name);
    if (slot !== null) namePlaque(sink, f, slot);
  }
};
