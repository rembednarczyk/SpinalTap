import { DRAIN_GRATE, HOUSE_PLATE, STICKER, STICKER_HOSTS, type StreetPropKind, grateLayout, graffitiLayout, hostFace, plateLayout, stickerLayout } from "@seki/core";
import { MeshSink, type Rgba, type Vec } from "../mesh-sink";
import { graffitiModel } from "./decal-paint";
import { type WorldProp, bake } from "./prop-batch";
import { paint } from "./prop-kit";

/**
 * The decals of ADR-0058 stage 6 in the street furniture's block mesh: graffiti (`decal-paint.ts`),
 * house number plates, stickers on their hosts and gully grates, each built from its variant (the
 * layout of `@seki/core`'s `decals.ts`) in the piece's frame and baked at its place like the rest of
 * the furniture: vertices, not draw calls. On phones (`low`) the plates and stickers stay out.
 */

/** Small decals the phones go without. */
export const FINE_DECALS: ReadonlySet<StreetPropKind> = new Set(["sticker", "house-plate"]);

const OUT: Vec = { x: 0, y: 0, z: 1 };
const ENAMEL = paint("#1d3f8f");
const WHITE = paint("#f2f2ee");
const IRON = paint("#3b3b3d");
const SLOT = paint("#101012");

/** How far a plate's face and its number stand off the wall, a sticker off its host's face (m). */
export const PLATE_OUT = { back: 0.012, face: 0.02, digits: 0.026 } as const;
export const STICKER_OUT = 0.003;

const flat = (sink: MeshSink, x0: number, y0: number, x1: number, y1: number, z: number, color: Rgba): void =>
  sink.quad(
    [
      { x: x0, y: y0, z },
      { x: x1, y: y0, z },
      { x: x1, y: y1, z },
      { x: x0, y: y1, z },
    ],
    OUT,
    color,
  );

/** Segments of the digits 0-9 (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const SEGMENTS: readonly string[] = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];
/** Lower-case letters of the house numbers the seven segments can draw; the rest a short bar. */
const LETTERS: Readonly<Record<string, string>> = {
  a: "abcdeg",
  b: "cdefg",
  c: "deg",
  d: "bcdeg",
  e: "adefg",
  f: "aefg",
  g: "abcdfg",
  h: "cefg",
};

/** A character of seven segments `w` x `h` with its lower left corner at (x, y). */
const segments = (sink: MeshSink, segs: string, x: number, y: number, w: number, h: number, t: number, z: number): void => {
  const m = y + h / 2;
  const at: Record<string, [number, number, number, number]> = {
    a: [x, y + h - t, x + w, y + h],
    b: [x + w - t, m, x + w, y + h],
    c: [x + w - t, y, x + w, m],
    d: [x, y, x + w, y + t],
    e: [x, y, x + t, m],
    f: [x, m, x + t, y + h],
    g: [x, m - t / 2, x + w, m + t / 2],
  };
  for (const s of segs) {
    const r = at[s];
    if (r) flat(sink, r[0], r[1], r[2], r[3], z, WHITE);
  }
};

/** A house number plate: blue enamel in a white rim, the number in white, a rule for the street's name over it. */
export const plateModel = (variant: number): MeshSink => {
  const p = plateLayout(variant);
  const sink = new MeshSink();
  const { width: w, height: h } = HOUSE_PLATE;
  const y0 = p.lift;
  sink.box({ x: 0, y: y0 + h / 2, z: PLATE_OUT.back / 2 }, w, h, PLATE_OUT.back, WHITE);
  flat(sink, -w / 2 + 0.012, y0 + 0.012, w / 2 - 0.012, y0 + h - 0.012, PLATE_OUT.face, ENAMEL);
  flat(sink, -w * 0.36, y0 + h - 0.05, w * 0.36, y0 + h - 0.038, PLATE_OUT.digits, WHITE);
  const chars = [...(p.number > 0 ? String(p.number) : "")].map((c) => SEGMENTS[Number(c)]!);
  if (p.letter > 0) chars.push(LETTERS[String.fromCharCode(96 + p.letter)] ?? "g");
  const cw = 0.05;
  const gap = 0.018;
  const total = chars.length * cw + Math.max(0, chars.length - 1) * gap;
  chars.forEach((segs, k) => segments(sink, segs, -total / 2 + k * (cw + gap), y0 + 0.035, cw, 0.11, 0.013, PLATE_OUT.digits));
  return sink;
};

/** A sticker's two colours by design. */
const STICKER_COLOURS: readonly (readonly [string, string])[] = [
  ["#ff3fa4", "#141418"],
  ["#2ee6ff", "#141418"],
  ["#f2f2ee", "#d01f2f"],
  ["#ffe23a", "#141418"],
  ["#a6ff3c", "#2a1840"],
  ["#141418", "#ff8a1f"],
  ["#8a5cff", "#f2f2ee"],
  ["#f2f2ee", "#1d3f8f"],
];

/** A sticker on its host's face, in the host's frame (the piece stands at the host's foot with its yaw). */
export const stickerModel = (variant: number): MeshSink => {
  const s = stickerLayout(variant);
  const sink = new MeshSink();
  const host = STICKER_HOSTS[s.host];
  if (!host) return sink;
  const [bg, fg] = STICKER_COLOURS[s.design % STICKER_COLOURS.length]!.map((c) => paint(c));
  const corner = (along: number, y: number, extra: number): Vec => {
    const f = hostFace(host, s.face, y);
    const r = f.out + STICKER_OUT + extra;
    return { x: f.nx * r - f.nz * along, y, z: f.nz * r + f.nx * along };
  };
  const n0 = hostFace(host, s.face, s.lift);
  const n: Vec = { x: n0.nx, y: 0, z: n0.nz };
  const card = (a0: number, a1: number, y0: number, y1: number, extra: number, color: Rgba) =>
    sink.quad([corner(a0, y0, extra), corner(a1, y0, extra), corner(a1, y1, extra), corner(a0, y1, extra)], n, color);
  const { width: w, height: h } = STICKER;
  card(-w / 2, w / 2, s.lift - h / 2, s.lift + h / 2, 0, bg!);
  card(-w * 0.3, w * 0.3, s.lift - h * 0.1, s.lift + h * 0.3, 0.001, fg!);
  return sink;
};

/** A gully grate: an iron frame with dark slots across, laid on the road's fall. */
export const grateModel = (variant: number): MeshSink => {
  const g = grateLayout(variant);
  const sink = new MeshSink();
  const { length: l, width: w, bottom, top } = DRAIN_GRATE;
  const y = (x: number, z: number, h: number) => h + g.slopeX * x + g.slopeZ * z;
  const at = (x: number, z: number, h: number): Vec => ({
    x,
    y: y(x, z, h),
    z,
  });
  const up: Vec = { x: -g.slopeX, y: 1, z: -g.slopeZ };
  const [hl, hw] = [l / 2, w / 2];
  sink.quad([at(-hl, -hw, top), at(hl, -hw, top), at(hl, hw, top), at(-hl, hw, top)], up, IRON);
  for (const [nx, nz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    // The side's two ends: along x for the faces across z, along z for the ends.
    const p0 = nz !== 0 ? ([-hl, nz * hw] as const) : ([nx * hl, -hw] as const);
    const p1 = nz !== 0 ? ([hl, nz * hw] as const) : ([nx * hl, hw] as const);
    sink.quad([at(p0[0], p0[1], bottom), at(p1[0], p1[1], bottom), at(p1[0], p1[1], top), at(p0[0], p0[1], top)], { x: nx, y: 0, z: nz }, IRON);
  }
  const slots = g.casting === 0 ? 6 : 8;
  const pitch = (l - 0.08) / slots;
  for (let k = 0; k < slots; k++) {
    const x0 = -hl + 0.04 + pitch * (k + 0.2);
    const x1 = x0 + pitch * 0.6;
    const z0 = -hw + 0.035;
    const z1 = hw - 0.035;
    sink.quad([at(x0, z0, top + 0.002), at(x1, z0, top + 0.002), at(x1, z1, top + 0.002), at(x0, z1, top + 0.002)], up, SLOT);
  }
  return sink;
};

/** A decal's model in its piece's frame, from its kind and variant; null for a kind that is no decal. */
export const decalModel = (prop: StreetPropKind, variant: number): MeshSink | null => {
  switch (prop) {
    case "graffiti":
      return graffitiModel(graffitiLayout(variant));
    case "house-plate":
      return plateModel(variant);
    case "sticker":
      return stickerModel(variant);
    case "drain-grate":
      return grateModel(variant);
    default:
      return null;
  }
};

/** Bakes a decal at its piece's place (a piece without a variant is the layout 0). */
export const bakeDecal = (sink: MeshSink, p: WorldProp): void => {
  const m = decalModel(p.prop, p.variant ?? 0);
  if (m) bake(sink, m, p);
};
