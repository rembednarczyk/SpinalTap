import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { SIGN_OUT, SIGN_RADIUS, bracketSpots } from "./bracket-plan";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";
import { type BladeSpot, hasShopSigns, housingBottom, placeBlade, signStream } from "./blade-housings";
import { hushedOnWall, quietStretches } from "./remembrance-clear";
import { clearStretches, fitFlatSign, wallNear } from "./sign-room";
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
export const MAP_SIGN_KIND = { board: 0, holo: 1, name: 2, tube: 3, reflection: 4, blade: 5, disc: 6, ad: 7, beam: 8, mist: 9, strobe: 10, venue: 11, glyph: 12, screen: 13, holoPanel: 14 } as const;

/**
 * A kind plus `kind` is drawn near only (ADR-0074 C4): Alchemia's front hangs its letters, holograms
 * and screens' pictures in the cell's signs, which show for hundreds of metres, but its own mesh
 * goes beyond some 135 m of the hall's middle, which its farthest light is 42 m off. They fade out between `from`
 * and `to` metres off the eye, so nothing of them hangs in the air where the building is gone.
 */
export const NEAR_ONLY = { kind: 16, from: 75, to: 92 } as const;

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

/** A blade sign: two faces back to back on its housing's panel, both readable (ADR-0096 rule 5). */
const blade = (sink: MeshSink, b: BladeSpot, color: Rgba): void => {
  const w = b.wall;
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  const { panel, face } = b.housing;
  const bottom = housingBottom(b.housing, b.y);
  const p = (out: number, yy: number, side: number): Vec => ({ x: w.a.x + dx * (b.u + side * face) + w.nx * out, y: yy, z: w.a.z + dz * (b.u + side * face) + w.nz * out });
  const corners = (side: number) => [p(panel.out0, bottom + panel.y0, side), p(panel.out1, bottom + panel.y0, side), p(panel.out1, bottom + panel.y1, side), p(panel.out0, bottom + panel.y1, side)] as const;
  quadUv(sink, corners(1), { x: dx, y: 0, z: dz }, color, UV_MIRROR, [b.cell, MAP_SIGN_KIND.blade]);
  quadUv(sink, corners(-1), { x: -dx, y: 0, z: -dz }, color, UV, [b.cell, MAP_SIGN_KIND.blade]);
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

/**
 * May a holo-ad hang on this wall (`holos`: seven in ten of them do)? A firewall at least 7 m long
 * with 7 m of it in view over its neighbour. The decals keep off it (ADR-0058 stage 6).
 */
export const holoMayHang = (f: FacadeFrame, w: Wall): boolean => w.blind && !hiddenWall(f, w) && w.length >= 7 && f.top - Math.max(w.coveredTo, f.b.base) >= 7;

/** Holo-ads: on firewalls that rise over lower neighbours, and high on tall buildings. */
const holos = (sink: MeshSink, f: FacadeFrame, rand: () => number): void => {
  for (const w of f.walls) {
    if (!holoMayHang(f, w) || rand() > 0.7) continue;
    const from = Math.max(w.coveredTo, f.b.base);
    const exposed = f.top - from;
    const color = signTint(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1);
    const seed = rand();
    // A neighbour taller than the one against the wall may stand out in front of its end (G-157).
    const bottom = from + exposed * 0.125;
    const width = Math.min(w.length * 0.7, 14);
    // A narrow wall's whole ad is narrower than HOLO_MIN: only a neighbour may leave it out (G-157).
    const fit = fitFlatSign(f, w, w.length / 2, width, Math.min(HOLO_MIN, width), 0.45, bottom);
    if (!fit || hushedOnWall(f.b.remembrance, w, fit.u - fit.width / 2, fit.u + fit.width / 2, 0.45)) continue;
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
    if (!fit || hushedOnWall(f.b.remembrance, w, fit.u - fit.width / 2, fit.u + fit.width / 2, 0.8)) return;
    const height = Math.min(fit.width * 1.4, tall * 0.4);
    flatOnWall(sink, w, fit.u, f.top - height / 2 - 2, 0.8, fit.width, height, color, [seed, MAP_SIGN_KIND.holo]);
  }
};

/** Width of the shop board on a street wall (it depends on the wall only). */
export const shopBoardWidth = (w: Wall): number => Math.min(w.length * 0.55, 7);

/** Height of the shop board on a street wall, centred 0.45 m under the ground floor's top. */
export const shopBoardHeight = (w: Wall): number => Math.min(Math.max(shopBoardWidth(w) / 4, 0.6), 1.3);

/** A shop board on a street wall, as drawn: its place, size, tint, atlas cell and reflection's seed. */
interface ShopBoard {
  readonly wall: Wall;
  readonly u: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly cell: number;
  readonly seed: number;
}

/**
 * The atlas's shop boards and blades of a building, from the signs' stream in its order (each wall:
 * the board's tint and place, its cell and seed on a shopfront, then a blade's chance, end, tint,
 * cell and seed): `planBuildingSigns` draws them, the facade hangs the blades' housings (`shopBlades`).
 */
export const shopSignPlan = (f: FacadeFrame, rand: () => number): { boards: ShopBoard[]; blades: BladeSpot[] } => {
  const boards: ShopBoard[] = [];
  const blades: BladeSpot[] = [];
  for (const w of streetWalls(f).slice(0, f.style.signs)) {
    const color = NEON[Math.floor(rand() * NEON.length)] ?? "#ff2e88";
    const width = shopBoardWidth(w);
    const u = width / 2 + 0.5 + rand() * Math.max(w.length - width - 1, 0);
    if (f.style.shopfront) {
      const cell = Math.floor(rand() * MAP_SIGN_BOARDS.length);
      boards.push({ wall: w, u, width, height: shopBoardHeight(w), color, cell, seed: rand() });
    }
    if (rand() < 0.6) {
      const end = rand();
      const tint = Math.floor(rand() * NEON.length);
      const cell = Math.floor(rand() * MAP_SIGN_BLADES.length);
      const spot = placeBlade(f, w, { end, color: tint, cell, seed: rand() });
      if (spot) blades.push(spot);
    }
  }
  return { boards, blades };
};

/** The blades of a building's shop signs, for their housings on the near facade. */
export const shopBlades = (f: FacadeFrame): readonly BladeSpot[] => (hasShopSigns(f) ? shopSignPlan(f, signStream(f)).blades : []);

/** Shop boards, blades and their reflections on the street walls. */
const shopSigns = (sink: MeshSink, f: FacadeFrame, rand: () => number, ground: SignGround): void => {
  const plan = shopSignPlan(f, rand);
  const groundY = f.b.foot + 0.16;
  for (const b of plan.boards) {
    // By a place of remembrance the board is left out (G-943).
    if (hushedOnWall(f.b.remembrance, b.wall, b.u - b.width / 2, b.u + b.width / 2, 0.1)) continue;
    flatOnWall(sink, b.wall, b.u, f.b.base + f.ground - 0.45, 0.1, b.width, b.height, signTint(b.color, 1), [b.cell, MAP_SIGN_KIND.board]);
    signReflection(sink, b.wall, b.u, ground, groundY, b.width * 0.9, 6, signTint(b.color, 0.8), b.seed);
  }
  for (const b of plan.blades) {
    const bc = signTint(NEON[b.color] ?? "#00e5ff", 1);
    blade(sink, b, bc);
    signReflection(sink, b.wall, b.u, ground, groundY, 1.4, 5, [bc[0], bc[1], bc[2], 0.6], b.seed);
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
    // Cut off by a place of remembrance's zone too (G-943).
    for (const [a, b] of quietStretches(f.b.remembrance, w, TUBE_OUT, clearStretches(f, w, TUBE_OUT, TUBE_OUT, y - TUBE_HEIGHT / 2, wallNear(f, w, TUBE_OUT)))) {
      // The samples may end a whole wall a hair short of its length, so a short wall keeps its tube.
      if (b - a >= Math.min(TUBE_MIN, w.length) - 1e-6) flatOnWall(sink, w, (a + b) / 2, y, TUBE_OUT, b - a, TUBE_HEIGHT, signTint(color, 1), [0, MAP_SIGN_KIND.tube]);
    }
  }
};

/**
 * Signs of one building. `nameSlot` gives the plaque's row in the names atlas (null: no room);
 * `ground` is where the neon's streaks lie (without it, the outline's lowest ground).
 */
export const planBuildingSigns = (sink: MeshSink, f: FacadeFrame, nameSlot: (name: string) => number | null, ground: SignGround = () => null): void => {
  const rand = signStream(f);
  // A room or a gate the game cut into the building (ADR-0045) carries the game's own sign there.
  if (f.b.bracketSigns) bracketSigns(sink, f, ground);
  // The map's own venues (ADR-0064 stage 4) sign the building instead of the atlas's boards (`planVenueSigns`).
  else if (hasShopSigns(f)) shopSigns(sink, f, rand, ground);
  if (f.style.neonTrim && f.style.cornice) tubes(sink, f, f.style.neonTrim);
  holos(sink, f, rand);
  if (f.b.name) {
    const slot = nameSlot(f.b.name);
    if (slot !== null) namePlaque(sink, f, slot);
  }
};
