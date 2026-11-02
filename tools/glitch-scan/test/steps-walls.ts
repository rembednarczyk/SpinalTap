/**
 * Flights of steps narrower in the game than the walls that flank them (G-203): a run of
 * `highway=steps` with a `barrier=wall` (or `retaining_wall`) on each side, parallel to it and
 * within `REACH` of its axis at the run's middle, the walls further apart than the band the game
 * lays on the run plus 1 m. The map rarely gives steps a `width`, so a monumental flight between
 * its walls becomes a 3 m strip with grass where the steps should be.
 */

type Pt = { readonly x: number; readonly z: number };

export interface MapWay {
  readonly id: string;
  readonly tags: Readonly<Record<string, string>>;
  readonly line: readonly Pt[];
}

/** How far off a run's axis a wall still flanks it (m). */
const REACH = 15;
/** The most a wall's direction may turn from the run's and still run beside it (sine of 15°). */
const PARALLEL = Math.sin((15 * Math.PI) / 180);
/** The slack between the walls and the band: a balustrade's or a kerb's width. */
const SLACK = 1;
const WALLS = new Set(["wall", "retaining_wall"]);

/** The signed offsets (left positive) of the walls parallel to a run that cross the normal through its middle. */
const wallOffsets = (m: Pt, u: Pt, walls: readonly MapWay[]): number[] =>
  walls.flatMap((w) =>
    w.line.slice(1).flatMap((b, i) => {
      const a = w.line[i]!;
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const len = Math.hypot(dx, dz);
      if (len < 0.1 || Math.abs((u.x * dz - u.z * dx) / len) > PARALLEL) return [];
      // Where the wall's segment crosses the normal through m: along the run, a's and b's positions bracket 0.
      const [sa, sb] = [(a.x - m.x) * u.x + (a.z - m.z) * u.z, (b.x - m.x) * u.x + (b.z - m.z) * u.z];
      if (Math.min(sa, sb) > 0 || Math.max(sa, sb) < 0) return [];
      const k = sa === sb ? 0 : sa / (sa - sb);
      const off = -(a.x + dx * k - m.x) * u.z + (a.z + dz * k - m.z) * u.x;
      return Math.abs(off) <= REACH ? [off] : [];
    }),
  );

/** Whether the segments p-q and a-b cross. */
const crosses = (p: Pt, q: Pt, a: Pt, b: Pt): boolean => {
  const side = (o: Pt, s: Pt, t: Pt) => Math.sign((s.x - o.x) * (t.z - o.z) - (s.z - o.z) * (t.x - o.x));
  return side(p, q, a) * side(p, q, b) < 0 && side(a, b, p) * side(a, b, q) < 0;
};

/**
 * Each run of steps between two walls further apart than `bandAcross(m, n)` + 1 m: the width of
 * the steps the game lays across the run's middle `m` along its left normal `n`. Walls with
 * another way between them (twin flights round a middle wall, Zaułek Hartwigów) flank both.
 */
export const stepsNarrowerThanWalls = (ways: readonly MapWay[], bandAcross: (m: Pt, n: Pt) => number): { readonly at: string; readonly what: string }[] => {
  const walls = ways.filter((w) => WALLS.has(w.tags.barrier ?? ""));
  const paths = ways.filter((w) => w.tags.highway !== undefined);
  const between = (self: MapWay, p: Pt, q: Pt) => paths.some((w) => w !== self && w.line.slice(1).some((b, i) => crosses(p, q, w.line[i]!, b)));
  return ways
    .filter((w) => w.tags.highway === "steps")
    .flatMap((w) =>
      w.line.slice(1).flatMap((b, i) => {
        const a = w.line[i]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.5) return [];
        const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
        const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const offs = wallOffsets(m, u, walls);
        const left = Math.min(...offs.filter((o) => o > 0));
        const right = Math.min(...offs.filter((o) => o < 0).map((o) => -o));
        if (!Number.isFinite(left) || !Number.isFinite(right)) return [];
        const n = { x: -u.z, z: u.x };
        if (between(w, { x: m.x - n.x * right, z: m.z - n.z * right }, { x: m.x + n.x * left, z: m.z + n.z * left })) return [];
        const band = bandAcross(m, n);
        const apart = left + right;
        return apart > band + SLACK ? [{ at: `${m.x.toFixed(0)},${m.z.toFixed(0)}`, what: `${w.id} ${band.toFixed(1)} m between walls ${apart.toFixed(1)} m apart` }] : [];
      }),
    );
};

/** The width (m) of the band of points `on` a surface across `m` along `n`, sampled every 0.1 m up to `REACH` each way. */
export const bandAcross = (on: (p: Pt) => boolean, m: Pt, n: Pt): number => {
  const at = (v: number) => on({ x: m.x + n.x * v, z: m.z + n.z * v });
  if (!at(0)) return 0;
  let [left, right] = [0, 0];
  while (left < REACH && at(left + 0.1)) left += 0.1;
  while (right < REACH && at(-right - 0.1)) right += 0.1;
  return left + right;
};

/** A lamp or a candelabrum (any `lamp-*`) standing inside a band of steps (G-203): on the treads, where a walker goes. */
export const lampsOnSteps = (props: readonly { readonly prop: string; readonly x: number; readonly z: number }[], onSteps: (p: Pt) => boolean): { readonly at: string; readonly what: string }[] =>
  props.filter((i) => i.prop.startsWith("lamp-") && onSteps(i)).map((i) => ({ at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`, what: `${i.prop} on steps` }));
