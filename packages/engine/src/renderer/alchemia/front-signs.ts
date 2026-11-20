import { ALCHEMIA_PIECES, type AlchemiaBox, type AlchemiaPiece, FRONT_SIGN, L2_TOP, L3, L3_TOP } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { MAP_SIGN_KIND, NEAR_ONLY, signTint } from "../mapcity/sign-plan";
import { type Uv, quadUv } from "../mapcity/sink-ops";
import { glyphAdvance, glyphCell } from "../mapcity/venue-plan";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";

/*
 * The light of Alchemia's front (ADR-0074 C4, the board `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`)
 * in the map city's signs' mesh, one cell's, so no draw call and no mesh more (as the metro's names,
 * `pavilion-signs.ts`), all of it drawn near only (`NEAR_ONLY`):
 * - the sign ALCHEMIA CENTRUM HANDLOWE: a lightbox lit from inside, its face a faint glow with a rim
 *   of light inside its frame, its letters white with a cyan halo, as the board's (the glyph atlas's
 *   font, ADR-0064; the box and its frame are the tiers' mesh, `front-sign-geometry.ts`);
 * - the two holograms by it: upright panels of light with a standing figure, a rain of glyphs, bars,
 *   scanlines and a frame, pink on the west, cyan on the east, rising over L3's roof;
 * - the pictures of the podium's and L3's screens: a slideshow of spots (`screen-glsl.ts`) over the
 *   screen's dark panel, each with its caption in the world's language.
 * Patterns: the mall's illuminated sign (a lightbox with channel letters) and its LED screens, the
 * holograms an additive light, as every neon of the city. The mall's own sign and the adverts' brands
 * are proper names, the same in every language (ADR-0056). Pure data.
 */

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** A kind drawn near only. */
const near = (kind: number): number => kind + NEAR_ONLY.kind;

/**
 * The sign's lines: text, the height of a letter's cell in the glyph atlas (its capitals some half
 * of it, ADR-0064), the middle of the capitals over the box's foot, how much broader than the atlas's
 * font (the board's is a broad sans).
 */
export const SIGN_LINES = [
  { text: "ALCHEMIA", height: 2.6, mid: 2.1, wide: 1.1 },
  { text: "CENTRUM HANDLOWE", height: 1.05, mid: 0.8, wide: 1.1 },
] as const;
/** Where in its cell the atlas's letter sits: its middle this much of the cell under the cell's (drawn at 0.56 from the top). */
const GLYPH_DROP = 0.06;
/** The letters' white, their halo's cyan (two rings of it), the face's glow. */
const LETTER = "#e9fdff";
const HALO = "#38dcff";
const HALOS = [
  { scale: 1.035, brightness: 0.8 },
  { scale: 1.12, brightness: 0.28 },
] as const;
const FACE_GLOW = "#9fe9ff";

/** How far off the box's face the letters and the glow hang, and how far in the frame reaches over it (`front-sign-geometry.ts`). */
const OFF_FACE = 0.03;
export const SIGN_FRAME = 0.16;

/**
 * The holograms by the sign: x span, foot and top, colour, off L3's south face; drawn as the screens'
 * program of a hologram (`screen-glsl.ts`). Their emitters are the tiers' mesh.
 */
export const FRONT_HOLOS = [
  // Over the trees on L2's west terrace (C2) by its top, as the board's over its plants.
  { x0: L3.minX + 1.4, x1: L3.minX + 4.0, y0: L2_TOP + 0.75, y1: L3_TOP + 3.2, tint: "#ff4fd8" },
  { x0: L3.maxX - 3.9, x1: L3.maxX - 0.9, y0: L2_TOP + 0.75, y1: L3_TOP + 3.0, tint: "#5ce1ff" },
] as const;
/** The screens' program that is a hologram. */
export const HOLO_PROGRAM = 3;
export const HOLO_Z = L3.minZ - 0.9;

/** The screens' colours and captions in turn (brands of the world's, no text for the player). */
const SCREEN_TINTS = ["#5ce1ff", "#ff4fd8", "#ffb000", "#39ff8a", "#b46cff"] as const;
const SCREEN_CAPTIONS = ["LUBLIN 2077", "SEKI", "NEO RAMEN", "ALCHEMIA", "CEBULARZ"] as const;
/** The screen's bezel, inside which its picture lies, and the caption's band (the picture's bottom fifth). */
const BEZEL = 0.06;
const BAND = 0.2;
/** The holograms' brightness: the board's are the brightest light on the front. */
const HOLO_BRIGHT = 1.5;

/** A flat quad centred at `c` facing along `n`, `w` across (to a reader's right) and `h` up. */
const flat = (sink: MeshSink, c: Vec, n: Vec, w: number, h: number, color: Rgba, uv2: Uv): void => {
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const p = (sx: number, sy: number): Vec => ({ x: c.x + (right.x * sx * w) / 2, y: c.y + (sy * h) / 2, z: c.z + (right.z * sx * w) / 2 });
  quadUv(sink, [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], n, color, UV, uv2);
};

/** A line of the glyph atlas's letters centred at `c` on a face looking along `n`: `h` high, `wide` times broader, squeezed into `room`. */
const glyphLine = (sink: MeshSink, text: string, c: Vec, n: Vec, h: number, wide: number, room: number, color: Rgba, scale = 1): number => {
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const natural = [...text].reduce((s, ch) => s + glyphAdvance(ch), 0) * h * wide;
  const k = Math.min(1, room / natural) * wide;
  let x = -(natural * k) / wide / 2;
  let n0 = 0;
  for (const ch of text) {
    const w = glyphAdvance(ch) * h * k;
    const cell = glyphCell(ch);
    if (cell !== null && ch !== " ") {
      const at = { x: c.x + right.x * (x + w / 2), y: c.y, z: c.z + right.z * (x + w / 2) };
      flat(sink, at, n, w * scale, h * scale, color, [cell + Math.min(glyphAdvance(ch), 0.98), near(MAP_SIGN_KIND.glyph)]);
      n0++;
    }
    x += w;
  }
  return n0;
};

const inside = (b: Box2, x: number, z: number): boolean => x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ;

/** The sign's lightbox: the glow of its face inside the frame, its letters and their halo. */
const sign = (sink: MeshSink): void => {
  const b = FRONT_SIGN;
  const n: Vec = { x: 0, y: 0, z: -1 };
  const mid = (b.x0 + b.x1) / 2;
  const [w, h] = [b.x1 - b.x0 - 2 * SIGN_FRAME, b.y1 - b.y0 - 2 * SIGN_FRAME];
  flat(sink, { x: mid, y: (b.y0 + b.y1) / 2, z: b.z0 - OFF_FACE / 2 }, n, w, h, signTint(FACE_GLOW, 0.8), [w / h, near(MAP_SIGN_KIND.venue)]);
  for (const line of SIGN_LINES) {
    const c = { x: mid, y: b.y0 + line.mid + GLYPH_DROP * line.height, z: b.z0 - OFF_FACE };
    for (const halo of HALOS) glyphLine(sink, line.text, c, n, line.height, line.wide, w - 0.6, signTint(HALO, halo.brightness), halo.scale);
    glyphLine(sink, line.text, c, n, line.height, line.wide, w - 0.6, signTint(LETTER, 1.3));
  }
};

/** The holograms by the sign. */
const holos = (sink: MeshSink): void => {
  for (const o of FRONT_HOLOS) {
    const [w, h] = [o.x1 - o.x0, o.y1 - o.y0];
    flat(sink, { x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2, z: HOLO_Z }, { x: 0, y: 0, z: -1 }, w, h, signTint(o.tint, HOLO_BRIGHT), [HOLO_PROGRAM + w / h / 16, near(MAP_SIGN_KIND.screen)]);
  }
};

/** The way a screen's picture faces: south on the front, off L3 on its sides. */
export const screenFacing = (b: AlchemiaBox): Vec => {
  if (b.x1 - b.x0 >= b.z1 - b.z0) return { x: 0, y: 0, z: -1 };
  return { x: (b.x0 + b.x1) / 2 > (L3.minX + L3.maxX) / 2 ? 1 : -1, y: 0, z: 0 };
};

/** The screens outside whose pictures the signs draw (the inside's keep their bands). */
export const pictureScreens = (pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES): AlchemiaPiece[] => pieces.filter((p) => p.kind === "screen" && !p.inside);

/** A screen's picture on its face, and its caption in the band at its foot. */
const picture = (sink: MeshSink, p: AlchemiaPiece, i: number): void => {
  const b = p.box;
  const n = screenFacing(b);
  const along = n.z !== 0 ? b.x1 - b.x0 : b.z1 - b.z0;
  const [w, h] = [along - 2 * BEZEL, b.y1 - b.y0 - 2 * BEZEL];
  const faceX = n.x > 0 ? b.x1 : b.x0;
  const c = n.z !== 0 ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: b.z0 - 0.015 } : { x: faceX + n.x * 0.015, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 };
  const tint = SCREEN_TINTS[i % SCREEN_TINTS.length]!;
  flat(sink, c, n, w, h, signTint(tint, 1), [(i % 3) + Math.min(w / h, 15.9) / 16, near(MAP_SIGN_KIND.screen)]);
  const caption = SCREEN_CAPTIONS[i % SCREEN_CAPTIONS.length]!;
  const at = { x: c.x + n.x * 0.01, y: c.y - h / 2 + (h * BAND) / 2, z: c.z + n.z * 0.01 };
  glyphLine(sink, caption, at, n, h * BAND * 1.1, 1.1, w * 0.9, signTint("#ffffff", 1.2));
};

/**
 * The front's light standing in a cell of the map city (by each piece's middle). The cell builder
 * calls it only for a cell that has signs already, so it never makes a mesh of its own. Returns how
 * many pieces it drew: the sign, the holograms, the screens.
 */
export const planAlchemiaSigns = (sink: MeshSink, bounds: Box2, pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES): number => {
  let drawn = 0;
  if (inside(bounds, (FRONT_SIGN.x0 + FRONT_SIGN.x1) / 2, (FRONT_SIGN.z0 + FRONT_SIGN.z1) / 2)) {
    sign(sink);
    holos(sink);
    drawn += 1 + FRONT_HOLOS.length;
  }
  pictureScreens(pieces).forEach((p, i) => {
    if (!inside(bounds, (p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2)) return;
    picture(sink, p, i);
    drawn++;
  });
  return drawn;
};
