import { type P2, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { GroundIndex } from "./ground-index";
import type { GroundChunk } from "./ground-strips";

/**
 * A strip by the kerb that flickers between grass and square (`kerb-fill-flicker`, G-825, the
 * curator's review of its third round): the ground just past a carriageway's edge, read every
 * `STEP` along the edges of the `road` pieces `OUT` out from them, falls into runs of one surface;
 * a run of grass or square shorter than `RUN_MIN` with the other of the two on both sides is a
 * strip whose surface was chosen sample by sample (Lwowska by Rondo Mohyły: square, grass, square
 * every 1-3 m, where the orthophoto shows one lawn behind one light kerb). Read off the tables
 * alone, so any strip laid so shows, whoever laid it. One finding a run, at its middle.
 */

type Finding = { readonly at: string; readonly what: string };
type Kind = "grass" | "square" | "other";

/** The shortest run of one surface between runs of the other (m). */
export const RUN_MIN = 5;
/** The samples' step along a carriageway's edge (m) and how far out from it they lie (m). */
const STEP = 0.5;
const OUT = 0.3;

const kindAt = (index: GroundIndex, x: number, z: number): Kind => {
  const s = index.at(x, z);
  if (s.length !== 1) return "other";
  return s[0] === "grass" || s[0] === "square" ? s[0] : "other";
};

/** The samples past the edges of one road piece's ring, in its order. */
const edgeSamples = (index: GroundIndex, ring: readonly P2[]): { p: P2; kind: Kind }[] => {
  const out: { p: P2; kind: Kind }[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const [dx, dz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    // The normal pointing off the piece.
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const sign = pointInRing({ x: mid.x + dz * 0.05, z: mid.z - dx * 0.05 }, ring) ? -1 : 1;
    const [nx, nz] = [dz * sign, -dx * sign];
    for (let t = STEP / 2; t < len; t += STEP) {
      const p = { x: a.x + dx * t + nx * OUT, z: a.z + dz * t + nz * OUT };
      out.push({ p, kind: kindAt(index, p.x, p.z) });
    }
  }
  return out;
};

/** The runs of one kind along `samples`, from the first sample of another kind round the ring. */
const runsOf = (samples: readonly { p: P2; kind: Kind }[]): { kind: Kind; from: number; n: number }[] => {
  const start = Math.max(0, samples.findIndex((s) => s.kind === "other"));
  const runs: { kind: Kind; from: number; n: number }[] = [];
  for (let m = 0; m < samples.length; m++) {
    const i = (start + m) % samples.length;
    const last = runs[runs.length - 1];
    if (last && last.kind === samples[i]!.kind) last.n++;
    else runs.push({ kind: samples[i]!.kind, from: i, n: 1 });
  }
  return runs;
};

export const kerbFillFlicker = (chunks: readonly GroundChunk[]): Finding[] => {
  const index = new GroundIndex(chunks);
  const out: Finding[] = [];
  for (const piece of index.pieces) {
    if (piece.surface !== "road") continue;
    const samples = edgeSamples(index, piece.ring);
    const runs = runsOf(samples);
    for (let r = 1; r + 1 < runs.length; r++) {
      const [before, run, after] = [runs[r - 1]!, runs[r]!, runs[r + 1]!];
      if (run.kind === "other" || run.n * STEP >= RUN_MIN || before.kind === run.kind || before.kind === "other" || after.kind !== before.kind) continue;
      const p = samples[(run.from + (run.n >> 1)) % samples.length]!.p;
      out.push({ at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, what: `${piece.chunk}: ${(run.n * STEP).toFixed(1)} m of ${run.kind} by the kerb between ${before.kind}` });
    }
  }
  return out;
};
