/**
 * Block letters of neon tube for Alchemia's sign on the pavilion's roof (ADR-0074 stage 3) and
 * Tessen's over W-3's wagon gate (ADR-0082 stage 4): the proper names ALCHEMIA and TESSEN, the
 * same in every language, as straight strokes the kit's glow swatches can draw in the same mesh
 * as their building (no glyph atlas, no draw call of its own). Pure data.
 */

/** A stroke: a rectangle in a letter's units, x across from its left, y up from its foot. */
type Stroke = readonly [number, number, number, number];

/** A tube's width, in units of a letter 5 high. */
const S = 0.8;
const MID = 2.1;

/** The strokes and the width of each letter the sign needs. */
const GLYPHS: Readonly<Record<string, { readonly w: number; readonly strokes: readonly Stroke[] }>> = {
  A: { w: 3, strokes: [[0, 0, S, 5], [3 - S, 0, 3, 5], [0, 5 - S, 3, 5], [0, MID, 3, MID + S]] },
  L: { w: 3, strokes: [[0, 0, S, 5], [0, 0, 3, S]] },
  C: { w: 3, strokes: [[0, 0, S, 5], [0, 5 - S, 3, 5], [0, 0, 3, S]] },
  H: { w: 3, strokes: [[0, 0, S, 5], [3 - S, 0, 3, 5], [0, MID, 3, MID + S]] },
  E: { w: 3, strokes: [[0, 0, S, 5], [0, 5 - S, 3, 5], [0, MID, 2.4, MID + S], [0, 0, 3, S]] },
  M: { w: 4, strokes: [[0, 0, S, 5], [4 - S, 0, 4, 5], [0, 5 - S, 4, 5], [2 - S / 2, 1.6, 2 + S / 2, 5]] },
  I: { w: 3, strokes: [[1.5 - S / 2, 0, 1.5 + S / 2, 5], [0.5, 5 - S, 2.5, 5], [0.5, 0, 2.5, S]] },
  T: { w: 3, strokes: [[0, 5 - S, 3, 5], [1.5 - S / 2, 0, 1.5 + S / 2, 5 - S]] },
  S: { w: 3, strokes: [[0, 5 - S, 3, 5], [0, MID, S, 5 - S], [0, MID, 3, MID + S], [3 - S, S, 3, MID], [0, 0, 3, S]] },
  // The diagonal in three steps: the strokes stay rectangles.
  N: { w: 3.4, strokes: [[0, 0, S, 5], [3.4 - S, 0, 3.4, 5], [S, 3, S + 0.6, 4.2], [1.4, 1.9, 2, 3.1], [2, 0.8, 2.6, 2]] },
};

/** The gap between letters, in units. */
const GAP = 1;

/** A stroke of the text in metres: `x0..x1` across from the text's middle (right of a reader), `y0..y1` up from its foot. */
export interface NeonStroke {
  /** The letter of the text it belongs to (0 for the first), for signs lit in two colours. */
  readonly letter: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** The width of `text` in metres when its letters are `height` high. */
export const neonWidth = (text: string, height: number): number => {
  const units = [...text].reduce((s, ch) => s + (GLYPHS[ch]?.w ?? 0), 0) + GAP * Math.max(0, text.length - 1);
  return (units * height) / 5;
};

/** The strokes of `text` (letters it has no glyph for are left out), centred, `height` high. */
export const neonText = (text: string, height: number): NeonStroke[] => {
  const u = height / 5;
  let x = -neonWidth(text, height) / 2;
  const out: NeonStroke[] = [];
  for (const [letter, ch] of [...text].entries()) {
    const g = GLYPHS[ch];
    if (!g) continue;
    for (const [a, b, c, d] of g.strokes) out.push({ letter, x0: x + a * u, x1: x + c * u, y0: b * u, y1: d * u });
    x += (g.w + GAP) * u;
  }
  return out;
};
