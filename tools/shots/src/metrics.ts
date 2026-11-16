/**
 * Numbers of one before/after pair of shots (`compare.ts`): pure functions on RGB pixels.
 * The thresholds are the ones of the hunters' probes (G-721, G-734), so old and new reports agree:
 * - a pixel changed when |dR| + |dG| + |dB| > 24;
 * - a pixel is burnt when R >= 250 and G >= 250 (sunlit paving washed to white), counted in the
 *   bottom half of the frame, where the ground is;
 * - luma is Rec. 709 (0.2126 R + 0.7152 G + 0.0722 B), 0-255.
 */

export interface Frame {
  readonly width: number;
  readonly height: number;
  /** R, G, B a pixel, rows top to bottom. */
  readonly rgb: Uint8Array;
}

export const CHANGED_SUM = 24;
export const BURNT = 250;

export const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Numbers of one shot. */
export interface FrameStats {
  /** Mean luma of the whole frame, 0-255. */
  readonly meanLuma: number;
  /** Burnt pixels in the bottom half of the frame, %. */
  readonly burntLowPct: number;
}

/** Numbers of a pair; the change ones are null when the two shots differ in size. */
export interface PairStats {
  readonly before: FrameStats;
  readonly after: FrameStats;
  /** Changed pixels in the whole frame, %. */
  readonly changedPct: number | null;
  /** Bottom-half pixels both changed and burnt after, % of the bottom half. */
  readonly burntAmongChangedPct: number | null;
  /** Mean luma of the changed bottom-half pixels before and after (what the change did to the ground). */
  readonly changedLowLuma: { readonly before: number; readonly after: number } | null;
}

const round = (x: number, digits: number): number => Number(x.toFixed(digits));
const pct = (n: number, of: number): number => (of === 0 ? 0 : round((100 * n) / of, 2));

const burnt = (rgb: Uint8Array, p: number): boolean => rgb[p]! >= BURNT && rgb[p + 1]! >= BURNT;

/** First pixel index of the bottom half (the middle row of an odd height belongs to it). */
const lowStart = (f: Frame): number => Math.floor(f.height / 2) * f.width;

export const frameStats = (f: Frame): FrameStats => {
  const n = f.width * f.height;
  const low = lowStart(f);
  let sum = 0;
  let hot = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 3;
    sum += luma(f.rgb[p]!, f.rgb[p + 1]!, f.rgb[p + 2]!);
    if (i >= low && burnt(f.rgb, p)) hot++;
  }
  return { meanLuma: n === 0 ? 0 : round(sum / n, 1), burntLowPct: pct(hot, n - low) };
};

export const pairStats = (a: Frame, b: Frame): PairStats => {
  const before = frameStats(a);
  const after = frameStats(b);
  if (a.width !== b.width || a.height !== b.height) return { before, after, changedPct: null, burntAmongChangedPct: null, changedLowLuma: null };
  const n = a.width * a.height;
  const low = lowStart(a);
  let changed = 0;
  let lowChanged = 0;
  let hotChanged = 0;
  let lumaA = 0;
  let lumaB = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 3;
    const d = Math.abs(a.rgb[p]! - b.rgb[p]!) + Math.abs(a.rgb[p + 1]! - b.rgb[p + 1]!) + Math.abs(a.rgb[p + 2]! - b.rgb[p + 2]!);
    if (d <= CHANGED_SUM) continue;
    changed++;
    if (i < low) continue;
    lowChanged++;
    if (burnt(b.rgb, p)) hotChanged++;
    lumaA += luma(a.rgb[p]!, a.rgb[p + 1]!, a.rgb[p + 2]!);
    lumaB += luma(b.rgb[p]!, b.rgb[p + 1]!, b.rgb[p + 2]!);
  }
  return {
    before,
    after,
    changedPct: pct(changed, n),
    burntAmongChangedPct: pct(hotChanged, n - low),
    changedLowLuma: lowChanged === 0 ? null : { before: round(lumaA / lowChanged, 1), after: round(lumaB / lowChanged, 1) },
  };
};

/** One line of the summary: `name: changed 12.3%, burnt bottom 2.20% -> 4.90%, luma 101 -> 97`. */
export const pairLine = (name: string, s: PairStats): string => {
  const changed = s.changedPct === null ? "sizes differ" : `changed ${s.changedPct.toFixed(1)}%`;
  const ground = s.changedLowLuma ? `, luma of changed ground ${s.changedLowLuma.before.toFixed(0)} -> ${s.changedLowLuma.after.toFixed(0)}` : "";
  return `${name}: ${changed}, burnt bottom ${s.before.burntLowPct.toFixed(2)}% -> ${s.after.burntLowPct.toFixed(2)}%, mean luma ${s.before.meanLuma.toFixed(0)} -> ${s.after.meanLuma.toFixed(0)}${ground}`;
};
