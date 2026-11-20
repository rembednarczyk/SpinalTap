import type { GroundPoint } from "@seki/core";
import type { Rect } from "../builders";
import { groundY, surfaceY } from "../lublin/terrain";
import { ARCADE_FRONT, ARCADE_WALK } from "./arcade-front";
import { P1, P1_RAMP } from "./parking";
import { type Box, type Piece, box, outlined, piece } from "./plan";

/*
 * The square before Alchemia's front on Bajkowskiego (C5 of the board 1:1, decisions of 19.11): the
 * board `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` shows a raised square before the house
 * with arcades, wide stairs down from it to the street and round its corner to the west, a round
 * fountain with a hologram at the stairs' head, food kiosks with awnings at their foot, drinks
 * machines by the ramp's parapet and tables under umbrellas.
 * Pattern: the "people place" before a building's entrance (J. Gehl, "Life Between Buildings", 1971,
 * and "Cities for People", 2010; Project for Public Spaces, "How to Turn a Place Around", 2000):
 * active edges (the arcade's shops, the kiosks), places to sit (chairs, the fountain's rim, a bench),
 * food and water, the stairs themselves as seats and a stage. Its podium is a deck on the ground (the
 * NMT stays as it is), its stairs solid steps by the rules (`docs/zasady-lokacji.md` §6).
 * The kiosks, tables and the game's furniture on it: `front-plaza-cafe.ts`.
 */

/** Rounded to the centimetre, as the simulation's other heights. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/** A step of the stairs: its rise and its going (§6: 0.15-0.18 and 0.28-0.30 m). */
export const PLAZA_RISER = 0.16;
export const PLAZA_GOING = 0.3;

/** The ramp's trench's west parapet's face: the podium and its stairs run up to it (the board's stairs end at the ramp's wall). */
const PARAPET_FACE = P1_RAMP.minX - P1.wall;
/** The arcade's walk ends at the west wing's glass (C3); east of the wing the passage under L2 goes on north. */
const WALK_END = ARCADE_FRONT.minZ + ARCADE_WALK;
const WING_EAST = 404;

/**
 * The podium: from the house with arcades' west corner to the ramp's parapet, from its south edge at
 * the stairs' head to the west wing's glass behind the arcade, whose walk it floors.
 */
export const PODIUM: Rect = { minX: ARCADE_FRONT.minX, maxX: PARAPET_FACE, minZ: -7.4, maxZ: WALK_END };

/** Steps down to the street (south, as far as the square's paving goes before the footway) and down round its west corner. */
export const SOUTH_STEPS = 5;
export const WEST_STEPS = 7;
/** Steps down north into the passage under L2 west of the ramp (the arcade's way on to the main entrance). */
export const PASSAGE_STEPS = 2;
/** The west stairs run north up to the green slope's foot (`front.ts`, `GREEN_STEPS`). */
const WEST_END = ARCADE_FRONT.minZ;

/**
 * The highest paving at the foot of the passage's steps: the podium lies a whole number of risers over
 * it. The paving, not the terrain: the square's setts are drawn `SURFACE_LIFT.square` (8 cm) over the
 * ground, and a riser is what the eye measures from them (a body stands on the terrain, its feet in the
 * setts, as everywhere in the city).
 */
const passagePaving = (): number => {
  const z = PODIUM.maxZ + PASSAGE_STEPS * PLAZA_GOING;
  let g = -Infinity;
  for (let x = WING_EAST; x <= PODIUM.maxX + 1e-6; x += 0.25) g = Math.max(g, surfaceY(x, z));
  return g;
};

/** The podium's top: one rise more than the passage's steps over the passage's paving. */
export const PLAZA_TOP = cm(passagePaving() + (PASSAGE_STEPS + 1) * PLAZA_RISER);

/** The ground (or the paving, `at`) under a box's footprint, lowest and highest, sampled every half metre. */
const groundRange = (x0: number, x1: number, z0: number, z1: number, at: (x: number, z: number) => number = groundY): { low: number; high: number } => {
  let [low, high] = [Infinity, -Infinity];
  const nx = Math.max(1, Math.ceil((x1 - x0) / 0.5));
  const nz = Math.max(1, Math.ceil((z1 - z0) / 0.5));
  for (let i = 0; i <= nx; i++) {
    for (let k = 0; k <= nz; k++) {
      const g = at(x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * k) / nz);
      [low, high] = [Math.min(low, g), Math.max(high, g)];
    }
  }
  return { low, high };
};

/** A step's band: which step (1 the highest), its top, its plan. */
export interface StepBand {
  readonly k: number;
  readonly top: number;
  readonly rect: Rect;
  /** Down which way: the going's direction. */
  readonly down: "s" | "w" | "n";
}

/**
 * The stairs' bands: each step of the south flight runs from the west flight's step of its rank to
 * the parapet, each of the west flight from the south one's back to the green slope's foot (round the
 * corner they are one L), the lower west steps past the south flight's last on the square's paving.
 */
const bands = (): StepBand[] => {
  const G = PLAZA_GOING;
  const P = PODIUM;
  const out: StepBand[] = [];
  for (let k = 1; k <= WEST_STEPS; k++) {
    const top = cm(PLAZA_TOP - k * PLAZA_RISER);
    const [x0, x1] = [P.minX - k * G, P.minX - (k - 1) * G];
    if (k <= SOUTH_STEPS) {
      out.push({ k, top, down: "s", rect: { minX: x0, maxX: P.maxX, minZ: P.minZ - k * G, maxZ: P.minZ - (k - 1) * G } });
      out.push({ k, top, down: "w", rect: { minX: x0, maxX: x1, minZ: P.minZ - (k - 1) * G, maxZ: WEST_END } });
    } else out.push({ k, top, down: "w", rect: { minX: x0, maxX: x1, minZ: P.minZ - SOUTH_STEPS * G, maxZ: WEST_END } });
  }
  // One more where the passage's paving lies lower than at its highest (it falls 6 cm along it): kept only there, so no riser at the foot is over 0.18.
  for (let k = 1; k <= PASSAGE_STEPS + 1; k++) {
    out.push({ k, top: cm(PLAZA_TOP - k * PLAZA_RISER), down: "n", rect: { minX: WING_EAST, maxX: P.maxX, minZ: P.maxZ + (k - 1) * G, maxZ: P.maxZ + k * G } });
  }
  return out;
};

/** A step's length is cut in parts of this most (each a prism of the solids). */
const STEP_PART = 1.2;
/**
 * How far a step's top stands over the lowest paving under it at least: lower, the paving has it (the
 * steps die into the slope). Kept wherever it comes out of the paving at all, the step above it is
 * never more than a riser and this over the paving (§6: 0.15-0.18); the paving may come a few
 * centimetres over its tread's back up the slope, as on steps along a sloping street.
 */
const OVER_PAVING = 0.01;
/** Where along a step the ground is looked at. */
const SLICE = 0.1;

/** A band's part from `a` to `b` along its length. */
const partOf = (r: Rect, alongX: boolean, a: number, b: number): Rect => (alongX ? { ...r, minX: r.minX + a, maxX: r.minX + b } : { ...r, minZ: r.minZ + a, maxZ: r.minZ + b });

/**
 * The steps the ground leaves: each band where its top comes out of the paving (the ground falls west,
 * so the south flight's steps run out to the east, as steps along a sloping street do; looked at every
 * 10 cm, so a step ends where the ground comes up to it), in parts along its length, each solid from
 * under the ground to its top.
 */
export const PLAZA_STEPS: readonly (StepBand & { readonly box: Box })[] = bands().flatMap((b) => {
  const r = b.rect;
  const alongX = b.down === "s" || b.down === "n";
  const len = alongX ? r.maxX - r.minX : r.maxZ - r.minZ;
  const slices = Math.max(1, Math.round(len / SLICE));
  const free = Array.from({ length: slices }, (_, i) => {
    const q = partOf(r, alongX, (len * i) / slices, (len * (i + 1)) / slices);
    return b.top >= groundRange(q.minX, q.maxX, q.minZ, q.maxZ, surfaceY).low + OVER_PAVING;
  });
  // Runs of free slices, each cut into parts of at most STEP_PART.
  const out: (StepBand & { box: Box })[] = [];
  for (let i = 0; i < slices; ) {
    if (!free[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < slices && free[j]) j++;
    const [a, z] = [(len * i) / slices, (len * j) / slices];
    const n = Math.max(1, Math.ceil((z - a) / STEP_PART - 1e-9));
    for (let k = 0; k < n; k++) {
      const part = partOf(r, alongX, a + ((z - a) * k) / n, a + ((z - a) * (k + 1)) / n);
      const g = groundRange(part.minX, part.maxX, part.minZ, part.maxZ);
      out.push({ ...b, rect: part, box: box(cm(part.minX), cm(part.maxX), cm(part.minZ), cm(part.maxZ), cm(g.low - 0.3), b.top) });
    }
    i = j;
  }
  return out;
});

/** What the podium and its stairs cover, in plan (the map's furniture keeps clear of it). */
export const PLAZA_FLOOR: Rect = {
  minX: PODIUM.minX - WEST_STEPS * PLAZA_GOING,
  maxX: PODIUM.maxX,
  minZ: PODIUM.minZ - SOUTH_STEPS * PLAZA_GOING,
  maxZ: PODIUM.maxZ + (PASSAGE_STEPS + 1) * PLAZA_GOING,
};

/** The podium: a deck from under the ground to its top, the arcade's walk on it. */
const podium = (): Piece[] => {
  const P = PODIUM;
  const g = groundRange(P.minX, P.maxX, P.minZ, P.maxZ);
  return [piece(box(P.minX, P.maxX, P.minZ, P.maxZ, cm(g.low - 0.3), PLAZA_TOP), "paving", false)];
};

/**
 * Light along the stairs' head round the corner (§4: the way always lit) and along the passage's
 * steps' head: a strip in the nose of the podium's edge. Drawn only.
 */
const stairLights = (): Piece[] => {
  const P = PODIUM;
  const y = PLAZA_TOP;
  return [
    piece(box(P.minX, P.maxX, P.minZ - 0.03, P.minZ, y - 0.07, y - 0.02), "led", false, false),
    piece(box(P.minX - 0.03, P.minX, P.minZ, WEST_END, y - 0.07, y - 0.02), "led", false, false),
    piece(box(WING_EAST, P.maxX, P.maxZ, P.maxZ + 0.03, y - 0.07, y - 0.02), "led", false, false),
  ];
};

/** The rail on the ramp's parapet along the podium: posts and a top rail a metre over the podium (the board's), drawn only (the parapet holds). */
const parapetRail = (): Piece[] => {
  const x0 = PARAPET_FACE + 0.06;
  const x1 = x0 + 0.06;
  const [z0, z1] = [PODIUM.minZ - SOUTH_STEPS * PLAZA_GOING + 0.1, PODIUM.maxZ - 0.1];
  const top = PLAZA_TOP + 1.0;
  const out: Piece[] = [piece(box(x0 - 0.01, x1 + 0.01, z0, z1, top - 0.05, top), "rail", false, false)];
  for (let z = z0; z <= z1 + 1e-6; z += 1.5) out.push(piece(box(x0, x1, z, z + 0.05, PLAZA_TOP - 0.4, top - 0.05), "rail", false, false));
  return out;
};

/** The round fountain at the stairs' head before the arcade (the board's, in place of B4's square one). */
export const FOUNTAIN_CENTRE: GroundPoint = { x: 399.5, z: -5.2 };
export const FOUNTAIN_RADIUS = 1.6;
const RIM_THICK = 0.25;
/** The rim knee high over the podium: a seat. */
export const FOUNTAIN_RIM = 0.42;
const FOUNTAIN_SIDES = 20;
/** The fountain's bounds, in plan. */
export const FOUNTAIN: Rect = {
  minX: FOUNTAIN_CENTRE.x - FOUNTAIN_RADIUS,
  maxX: FOUNTAIN_CENTRE.x + FOUNTAIN_RADIUS,
  minZ: FOUNTAIN_CENTRE.z - FOUNTAIN_RADIUS,
  maxZ: FOUNTAIN_CENTRE.z + FOUNTAIN_RADIUS,
};

/** A point on a circle round the fountain's centre. */
const onCircle = (r: number, a: number): GroundPoint => ({ x: FOUNTAIN_CENTRE.x + r * Math.cos(a), z: FOUNTAIN_CENTRE.z + r * Math.sin(a) });
/** The angle of side `i` of the circle's polygon. */
const angle = (i: number): number => (2 * Math.PI * i) / FOUNTAIN_SIDES;

/**
 * A ring round the fountain from radius `r0` to `r1`, one convex quad a side, counter-clockwise (the
 * rounded slabs' pattern, `rounded.ts`: drawing and solid one outline).
 */
const ring = (r0: number, r1: number, y0: number, y1: number, kind: Piece["kind"], solid: boolean): Piece[] =>
  Array.from({ length: FOUNTAIN_SIDES }, (_, i) => outlined([onCircle(r1, angle(i)), onCircle(r1, angle(i + 1)), onCircle(r0, angle(i + 1)), onCircle(r0, angle(i))], y0, y1, kind, solid));

/**
 * The fountain: a round basin of a rim knee high, its water (solid: nobody wades in), a strip of light
 * round the rim's foot, a projector in the water and over it the board's hologram, an upright panel of
 * light with a band out of step (a cracked hologram, §3); a paper cup in the water (§5).
 */
const fountain = (): Piece[] => {
  const y = PLAZA_TOP;
  const top = cm(y + FOUNTAIN_RIM);
  const c = FOUNTAIN_CENTRE;
  const water = Array.from({ length: FOUNTAIN_SIDES }, (_, i) => onCircle(FOUNTAIN_RADIUS - RIM_THICK, angle(i)));
  const panel = { x0: c.x - 0.75, x1: c.x + 0.55, z: c.z + 0.55, y0: top + 0.5, y1: top + 2.5 };
  const out: Piece[] = [
    ...ring(FOUNTAIN_RADIUS - RIM_THICK, FOUNTAIN_RADIUS, y - 0.05, top, "paving", true),
    ...ring(FOUNTAIN_RADIUS, FOUNTAIN_RADIUS + 0.03, y + 0.04, y + 0.1, "led", false),
    outlined(water, y - 0.05, top - 0.1, "water"),
    // The projector at the panel's foot, solid in the water, its lens lit.
    piece(box(c.x - 0.2, c.x + 0.2, panel.z - 0.15, panel.z + 0.15, y - 0.05, top + 0.25), "column", false),
    piece(box(c.x - 0.14, c.x + 0.14, panel.z - 0.1, panel.z + 0.1, top + 0.25, top + 0.3), "led", false, false),
    // The hologram: a panel of light framed in cyan, floating over the water, one band slipped aside.
    piece(box(panel.x0, panel.x1, panel.z - 0.02, panel.z + 0.02, panel.y0, panel.y1), "holo", false, false),
    piece(box(panel.x0 - 0.04, panel.x1 + 0.04, panel.z - 0.03, panel.z + 0.03, panel.y1, panel.y1 + 0.04), "led", false, false),
    piece(box(panel.x0 - 0.04, panel.x1 + 0.04, panel.z - 0.03, panel.z + 0.03, panel.y0 - 0.04, panel.y0), "led", false, false),
    piece(box(panel.x0 - 0.04, panel.x0, panel.z - 0.03, panel.z + 0.03, panel.y0, panel.y1), "led", false, false),
    piece(box(panel.x1, panel.x1 + 0.04, panel.z - 0.03, panel.z + 0.03, panel.y0, panel.y1), "led", false, false),
    piece(box(panel.x0 + 0.25, panel.x1 + 0.2, panel.z - 0.035, panel.z + 0.035, panel.y0 + 1.15, panel.y0 + 1.27), "error", false, false),
    piece(box(c.x + 0.6, c.x + 0.68, c.z - 0.75, c.z - 0.67, top - 0.1, top - 0.02), "cup", false, false),
  ];
  return out;
};

/** Every drawn piece of the podium, its stairs and the fountain. */
export const plazaFloorPieces = (): Piece[] => [
  ...podium(),
  ...PLAZA_STEPS.map((s) => piece(s.box, "step", false)),
  ...stairLights(),
  ...parapetRail(),
  ...fountain(),
];
