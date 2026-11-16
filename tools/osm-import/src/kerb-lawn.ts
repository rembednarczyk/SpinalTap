/**
 * A moved carriageway's strip to a lawn (G-825, `kerbFills`): which stretches of a kerb's samples
 * reaching a lawn are laid as the lawn's and which as a square, read off the orthophoto's cover
 * past a kerb's width.
 */
import { COVER } from "../../orto/src/classify.ts";
import { type Pt } from "./geometry.ts";

/**
 * The widest gap to a lawn a moved carriageway's strip is laid as the lawn's over wherever (m): a
 * kerb's width. A wider one is the lawn's only where the orthophoto's cover past the kerb is green
 * with no paving or asphalt; else it is paving the lawn's mapped edge stops short of (Lwowska by
 * Rondo Mohyły, 1-2 m of it; Al. Tysiąclecia's north-east corner, asphalt and the kerb), laid as a
 * square, as the bare ground rule laid it before: as the lawn's, it put grass on the pavement (G-825 r3).
 */
export const LAWN_GAP = 0.6;
/** The step of the cover's samples across a strip to a lawn (m), half its cell. */
const COVER_STEP = 0.25;
const HARD: ReadonlySet<number> = new Set([COVER.paving, COVER.asphalt]);
/** The most of a stretch's samples that may show paving past the kerb for it to be the lawn's: the orthophoto's noise. */
const HARD_SHARE = 0.2;

/** A point of a carriageway's edge, the way out from it, and the lawn or paving its march reached. */
type LawnSample = { readonly edge: Pt; readonly dir: Pt; readonly hit: { readonly gap: number; readonly lawn?: true } | null };

/** The cover of a sample's strip past a kerb's width to the lawn: paving or asphalt where any of it is, else green where any is. */
export const pastKerbOf =
  (cover: (p: Pt) => number) =>
  (s: LawnSample): number => {
    let green = false;
    for (let t = LAWN_GAP + COVER_STEP / 2; t < s.hit!.gap; t += COVER_STEP) {
      const c = cover({ x: s.edge.x + s.dir.x * t, z: s.edge.z + s.dir.z * t });
      if (HARD.has(c)) return COVER.paving;
      green ||= c === COVER.green;
    }
    return green ? COVER.green : COVER.none;
  };

/**
 * The length of the run at the start of `stretch` that shows paving (`hard`): up to its last hard
 * sample with hard ones half of it or more, a sidewalk's end at a zebra or a node.
 */
const hardEnd = <S>(stretch: readonly S[], hard: (s: S) => boolean): number => {
  let n = 0;
  for (let k = 0, h = 0; k < stretch.length; k++) {
    if (!hard(stretch[k]!)) continue;
    h++;
    if (2 * h >= k + 1) n = k + 1;
  }
  return n;
};

/**
 * The samples of `side` whose strip to a lawn is laid as the lawn's: a stretch of samples reaching
 * a lawn is one surface, the lawn's where most of its samples are `green` and at most `HARD_SHARE`
 * of them `hard`, else a square; a lawn's stretch keeps the paving at its ends (by a zebra) a square.
 * Chosen sample by sample, the light kerb and the orthophoto's noise flipped the strip between
 * grass and square every 1-3 m along one lawn behind one kerb (Lwowska by Rondo Mohyły, G-825 r4);
 * by the most alone, grass went over the paving the stretch's other samples showed; with no hard
 * sample at all, a square went over the lawn of Ruska's link for a sidewalk's end at its zebra (r5).
 */
export const lawnStretches = <S extends LawnSample>(side: readonly S[], green: (s: S) => boolean, hard: (s: S) => boolean): Set<S> => {
  const out = new Set<S>();
  for (let i = 0; i < side.length; ) {
    let j = i;
    while (j < side.length && side[j]!.hit?.lawn) j++;
    const stretch = side.slice(i, j);
    if (2 * stretch.filter(green).length > stretch.length && stretch.filter(hard).length <= HARD_SHARE * stretch.length) {
      const [head, tail] = [hardEnd(stretch, hard), hardEnd([...stretch].reverse(), hard)];
      for (const s of stretch.slice(head, stretch.length - tail)) out.add(s);
    }
    i = Math.max(j, i + 1);
  }
  return out;
};
