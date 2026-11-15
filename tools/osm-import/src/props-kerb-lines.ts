/**
 * The kerbs the rule of the bollard rows walks (G-820, T-303): the car streets of Krakowskie and of
 * the Old Town's district outside the walls, each side of their carriageway as the import widths it
 * (`LublinStreetData.half`), sampled every `STEP` metres on the line `KERB_SET` metres out on the
 * pavement, where Lublin's cast-iron posts stand (orthophoto 2025-04, GSV 2025). A street the chunks
 * clip is joined back into one line, so its row runs on over a chunk's edge evenly.
 */
import { DISTRICTS } from "./config.ts";
import { type Pt, pointInRing } from "./geometry.ts";
import { OLD_TOWN_RING } from "./old-town.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";

/** How far out on the pavement from the kerb the posts stand (m). */
export const KERB_SET = 0.35;
/** The step a kerb is sampled in (m). */
export const STEP = 0.25;
/** The least reach of a carriageway past its axis for the side to have a kerb (m): 0 off its asphalt. */
export const LEAST_HALF = 0.5;

/** The classes whose kerbs get rows: the town's car streets (no living street or pedestrian street has a kerb to line). */
export const ROW_CLASSES: ReadonlySet<string> = new Set(["trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "trunk_link", "primary_link", "secondary_link", "tertiary_link"]);

/** The districts of the rule: Krakowskie and the Old Town's (Podzamcze and Nabrzeże keep OSM's bollards alone). */
export const ROW_DISTRICTS: readonly string[] = ["krakowskie", "stare-miasto"];
const RECTS = DISTRICTS.filter((d) => ROW_DISTRICTS.includes(d.slug)).map((d) => d.rect);

/** Is p in the rule's area: its districts, outside the town walls? */
export const inRowArea = (p: Pt): boolean => RECTS.some((r) => p.x >= r.minX && p.x < r.maxX && p.z >= r.minZ && p.z < r.maxZ) && !pointInRing(p, OLD_TOWN_RING);

/** A sample of a kerb: the post's spot, the kerb beside it, the way out over the pavement, the length along the line so far. */
export interface KerbSample {
  readonly p: Pt;
  readonly kerb: Pt;
  readonly out: Pt;
  readonly arc: number;
  /** The carriageway reaches this far past the axis on this side (m). */
  readonly half: number;
}

export interface KerbLine {
  /** `<street>|<kind>#<piece>:<side>`, stable from the chunks' order. */
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly side: 1 | -1;
  readonly samples: readonly KerbSample[];
}

interface Piece {
  pts: Pt[];
  half: number[];
}

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const same = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < 0.05 && Math.abs(a.z - b.z) < 0.05;

/** The pieces of a street the chunks clipped, joined end to start (they keep the way's direction). */
export const joinPieces = (pieces: readonly Piece[]): Piece[] => {
  const chains = pieces.map((p) => ({ pts: [...p.pts], half: [...p.half] }));
  for (let joined = true; joined; ) {
    joined = false;
    for (let a = 0; a < chains.length && !joined; a++)
      for (let b = 0; b < chains.length && !joined; b++) {
        if (a === b || !same(chains[a]!.pts[chains[a]!.pts.length - 1]!, chains[b]!.pts[0]!)) continue;
        chains[a] = { pts: [...chains[a]!.pts, ...chains[b]!.pts.slice(1)], half: [...chains[a]!.half, ...chains[b]!.half.slice(2)] };
        chains.splice(b, 1);
        joined = true;
      }
  }
  return chains;
};

/** One side of a joined street sampled every `STEP` along its axis, `KERB_SET` past its kerb (`side` 1 its left). */
export const sampleSide = (piece: Piece, side: 1 | -1): KerbSample[] => {
  const out: KerbSample[] = [];
  let arc = 0;
  for (let i = 0; i + 1 < piece.pts.length; i++) {
    const a = piece.pts[i]!;
    const b = piece.pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const n = { x: (-(b.z - a.z) / len) * side, z: ((b.x - a.x) / len) * side };
    const k = side === 1 ? 0 : 1;
    const [ha, hb] = [piece.half[2 * i + k] ?? 0, piece.half[2 * i + 2 + k] ?? 0];
    const steps = Math.max(1, Math.ceil(len / STEP));
    for (let s = out.length === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      const h = ha + (hb - ha) * t;
      const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const p = { x: q.x + n.x * (h + KERB_SET), z: q.z + n.z * (h + KERB_SET) };
      const last = out[out.length - 1];
      arc += last ? Math.hypot(p.x - last.p.x, p.z - last.p.z) : 0;
      out.push({ p, kerb: { x: q.x + n.x * h, z: q.z + n.z * h }, out: n, arc, half: h });
    }
  }
  return out;
};

/** How far either way of the kerb the import's widths give the carriageway's edge on the ground is looked for (m), and in what steps. */
export const KERB_REACH = 1.5;
const REACH_STEP = 0.1;

/**
 * The samples moved onto the carriageway's edge as the ground draws it: the kerb the widths give
 * lies up to a metre and a half off it where the ground was measured on the orthophoto, widened
 * at a car park along the kerb or narrowed (Plac Łokietka's east kerb 0.4 m into the paving, G-830).
 * The edge is the change from road to anything else nearest the kerb, within `KERB_REACH`; a sample
 * with road all over that reach lies on another carriageway (a junction) and stays, as does one with
 * no road near (no asphalt drawn). The lengths along the line are measured again.
 */
export const onGround = (samples: readonly KerbSample[], isRoad: (p: Pt) => boolean): KerbSample[] => {
  const out: KerbSample[] = [];
  for (const s of samples) {
    let best: number | null = null;
    let prev: boolean | null = null;
    for (let d = -KERB_REACH; d <= KERB_REACH + 1e-9; d += REACH_STEP) {
      const road = isRoad({ x: s.kerb.x + s.out.x * d, z: s.kerb.z + s.out.z * d });
      if (prev === true && !road && (best === null || Math.abs(d - REACH_STEP / 2) < Math.abs(best))) best = d - REACH_STEP / 2;
      prev = road;
    }
    const kerb = best === null ? s.kerb : { x: s.kerb.x + s.out.x * best, z: s.kerb.z + s.out.z * best };
    const p = { x: kerb.x + s.out.x * KERB_SET, z: kerb.z + s.out.z * KERB_SET };
    const last = out[out.length - 1];
    out.push({ ...s, p, kerb, arc: last ? last.arc + Math.hypot(p.x - last.p.x, p.z - last.p.z) : 0 });
  }
  return out;
};

/** Every kerb of the rule's classes in the chunks, both sides of each street, in the chunks' order. */
export const kerbLines = (chunks: readonly LublinChunkData[]): KerbLine[] => {
  const byStreet = new Map<string, Piece[]>();
  for (const c of chunks)
    for (const s of c.streets) {
      if (!ROW_CLASSES.has(s.kind) || !s.half) continue;
      const key = `${s.name}|${s.kind}`;
      byStreet.set(key, [...(byStreet.get(key) ?? []), { pts: flat(s.line), half: [...s.half] }]);
    }
  const out: KerbLine[] = [];
  for (const [key, pieces] of byStreet) {
    const [name, kind] = key.split("|") as [string, string];
    joinPieces(pieces).forEach((piece, k) => {
      if (!piece.pts.some(inRowArea)) return;
      for (const side of [1, -1] as const) out.push({ id: `${key}#${k}:${side === 1 ? "l" : "r"}`, name, kind, side, samples: sampleSide(piece, side) });
    });
  }
  return out;
};
