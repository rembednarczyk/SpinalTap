import { type GroundLookup, type Pt, type SideProfile, sideProfile, stations } from "./sidewalk-profile";
import { ruleOf } from "./sidewalk-rules";

/**
 * The four kinds of the sidewalks' uniformity (the user's decision of 26.11), read from the profiles
 * of `sidewalk-profile.ts` side by side, stretch by stretch (from junction to junction):
 * - `sidewalk-surface-patch`: the strip by the kerb paved with another surface than its district's
 *   rule (`sidewalk-rules.ts`), over at least `PATCH_MIN` stations;
 * - `sidewalk-gap`: bare ground, grass or a road inside the band, or a stretch's side with no walk
 *   for up to `HOLE_MAX` m between stations that have one;
 * - `sidewalk-step`: the band's pieces drawn at lifts `STEP_MIN` apart (a sidewalk's slabs by a
 *   footway or a square: 7-8 cm);
 * - `sidewalk-width-jump`: the strip narrower or wider than its stretch's side's median by over
 *   `WIDE_BY` (and `WIDE_SHARE`) over at least `WIDE_MIN` stations, not where a building takes the room.
 * One finding a run of stations, at its first, with its length.
 */

export type Finding = { readonly at: string; readonly what: string };

/** A street's axis as the scan has it. */
export interface Street {
  readonly id: string;
  readonly points: readonly Pt[];
  /** Its carriageway's half width, the widest (m). */
  readonly reach: number;
}

/** What the kinds read besides the ground: the district at a point (undefined off the map) and whether it is at a junction. */
export interface Context {
  readonly district: (x: number, z: number) => string | undefined;
  readonly junction: (street: string, x: number, z: number) => boolean;
}

export const PATCH_MIN = 2;
export const GAP_MIN = 0.5;
export const HOLE_MAX = 12;
export const STEP_MIN = 0.04;
export const WIDE_MIN = 3;
export const WIDE_BY = 1;
export const WIDE_SHARE = 0.35;

/** A station of one side: where, its district, and its profile (null: no walk by the kerb). */
interface Mark {
  readonly at: Pt;
  readonly district: string;
  readonly p: SideProfile | null;
}

/** A stretch's side: its street, which side, and its stations in order, none at a junction. */
export interface Stretch {
  readonly street: string;
  readonly side: "left" | "right";
  readonly marks: readonly Mark[];
}

/** Every street's sides cut at its junctions and the map's edge into stretches. */
export const stretches = (g: GroundLookup, ctx: Context, streets: readonly Street[]): Stretch[] => {
  const out: Stretch[] = [];
  for (const s of streets) {
    const along = stations(s.points);
    for (const side of ["left", "right"] as const) {
      const k = side === "left" ? 1 : -1;
      let run: Mark[] = [];
      const close = () => {
        if (run.length > 0) out.push({ street: s.id, side, marks: run });
        run = [];
      };
      for (const st of along) {
        const district = ctx.district(st.at.x, st.at.z);
        if (district === undefined || ctx.junction(s.id, st.at.x, st.at.z)) {
          close();
          continue;
        }
        run.push({ at: st.at, district, p: sideProfile(g, st.at, { x: st.left.x * k, z: st.left.z * k }, s.reach) });
      }
      close();
    }
  }
  return out;
};

const key = (p: Pt) => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

/** The runs of consecutive marks for which `hit` holds, each as its first mark and its length. */
const runs = (marks: readonly Mark[], hit: (m: Mark, i: number) => boolean, min: number): { first: Mark; n: number; i: number }[] => {
  const out: { first: Mark; n: number; i: number }[] = [];
  let start = -1;
  for (let i = 0; i <= marks.length; i++) {
    const on = i < marks.length && hit(marks[i]!, i);
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= min) out.push({ first: marks[start]!, n: i - start, i: start });
      start = -1;
    }
  }
  return out;
};

const label = (s: Stretch) => `${s.street} ${s.side}`;

export const surfacePatches = (all: readonly Stretch[]): Finding[] =>
  all.flatMap((s) =>
    runs(s.marks, (m) => !!m.p && !(ruleOf(m.district)?.expected ?? [m.p.strip.surface]).includes(m.p.strip.surface), PATCH_MIN).map((r) => ({
      at: key(r.first.at),
      what: `${label(s)}: ${r.first.p!.strip.surface} by the kerb over ${r.n} m, ${r.first.district} has ${ruleOf(r.first.district)!.expected.join(" or ")}`,
    })),
  );

export const gaps = (all: readonly Stretch[]): Finding[] =>
  all.flatMap((s) => {
    const inside = runs(s.marks, (m) => !!m.p && m.p.gap >= GAP_MIN, 1).map((r) => ({ at: key(r.first.at), what: `${label(s)}: ${r.first.p!.gap.toFixed(2)} m of no walk inside the band, over ${r.n} m` }));
    const holes = runs(s.marks, (m) => !m.p, 1)
      .filter((r) => r.n <= HOLE_MAX && r.i > 0 && r.i + r.n < s.marks.length)
      .map((r) => ({ at: key(r.first.at), what: `${label(s)}: no walk by the kerb over ${r.n} m between walks` }));
    return [...inside, ...holes];
  });

export const steps = (all: readonly Stretch[]): Finding[] =>
  all.flatMap((s) =>
    runs(s.marks, (m) => !!m.p && m.p.step >= STEP_MIN, 1).map((r) => ({ at: key(r.first.at), what: `${label(s)}: pieces of the walk ${r.first.p!.step.toFixed(2)} m apart in lift, over ${r.n} m` })),
  );

const median = (v: readonly number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

export const widthJumps = (all: readonly Stretch[]): Finding[] =>
  all.flatMap((s) => {
    const widths = s.marks.flatMap((m) => (m.p && m.p.strip.width > 0 ? [m.p.strip.width] : []));
    if (widths.length < WIDE_MIN * 2) return [];
    const mid = median(widths);
    const off = (w: number) => Math.abs(w - mid) > Math.max(WIDE_BY, WIDE_SHARE * mid);
    return runs(s.marks, (m) => !!m.p && m.p.strip.width > 0 && off(m.p.strip.width) && m.p.strip.next !== "building", WIDE_MIN).map((r) => ({
      at: key(r.first.at),
      what: `${label(s)}: the strip ${r.first.p!.strip.width.toFixed(2)} m wide against the stretch's ${mid.toFixed(2)} m, over ${r.n} m`,
    }));
  });

/** How far past another street's carriageway a station counts as at its junction (m): the crossing's corners and kerb radii. */
export const JUNCTION = 4;

/** Is (x, z) of `street` within another street's half width plus `JUNCTION` of its axis? On a grid of the axes' points every metre. */
export const junctionTest = (streets: readonly Street[]): ((street: string, x: number, z: number) => boolean) => {
  const CELL = 16;
  const grid = new Map<string, { id: string; x: number; z: number; r: number }[]>();
  for (const s of streets)
    for (const st of stations(s.points)) {
      const k = `${Math.floor(st.at.x / CELL)},${Math.floor(st.at.z / CELL)}`;
      const cell = grid.get(k) ?? [];
      cell.push({ id: s.id, x: st.at.x, z: st.at.z, r: s.reach + JUNCTION });
      grid.set(k, cell);
    }
  return (street, x, z) => {
    const [cx, cz] = [Math.floor(x / CELL), Math.floor(z / CELL)];
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++)
        for (const p of grid.get(`${i},${j}`) ?? []) if (p.id !== street && Math.hypot(p.x - x, p.z - z) < p.r) return true;
    return false;
  };
};
