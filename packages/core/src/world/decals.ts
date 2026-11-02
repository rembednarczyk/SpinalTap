import type { StreetPropKind } from "./city-geo";

/**
 * Decals of Lublin 2077 (ADR-0058 stage 6): graffiti on walls without glass, house numbers by the
 * map's addresses, stickers on poles and cabinets, gully grates at the kerb. Each is a piece of the
 * street furniture (drawn only, no solid) whose variant packs its layout, so the importer, the
 * renderer and the glitch scan read one encoding. A wall decal stands at the middle of its bottom
 * edge on the wall's face, facing out (`yaw`); its bottom is `lift` metres over the piece's `y`
 * (the ground the game puts the furniture on). A sticker stands at its host's foot with the
 * host's yaw and names the face of the host it is on.
 */

export const DECAL_KINDS: ReadonlySet<StreetPropKind> = new Set(["graffiti", "house-plate", "sticker", "drain-grate"]);

/** Decals on a building's wall (the others are on a host piece or on the road). */
export const WALL_DECALS: ReadonlySet<StreetPropKind> = new Set(["graffiti", "house-plate"]);

const dm = (m: number, bits: number): number => Math.max(0, Math.min((1 << bits) - 1, Math.round(m * 10)));

/** A piece of graffiti: one of 8 designs, its size and the height of its bottom over the ground (m, in 0.1 m steps). */
export interface GraffitiLayout {
  readonly design: number;
  readonly width: number;
  readonly height: number;
  readonly lift: number;
  /** Painted on the face of the building's plinth band (the renderer's dark stone round its foot), not on the wall behind it. */
  readonly band?: boolean;
}

export const GRAFFITI_DESIGNS = 8;
/** The highest lift a graffiti variant and a plate variant hold (m). */
export const GRAFFITI_MAX_LIFT = 51.1;
export const PLATE_MAX_LIFT = 6.3;

/** Bits 0-2 the design, 3-8 the width (dm), 9-14 the height (dm), 15-23 the lift (dm), 24 on the plinth band. */
export const graffitiVariant = (g: GraffitiLayout): number =>
  ((g.design & 7) | (dm(g.width, 6) << 3) | (dm(g.height, 6) << 9) | (dm(g.lift, 9) << 15) | (g.band ? 1 << 24 : 0)) >>> 0;

export const graffitiLayout = (v: number): GraffitiLayout => ({
  design: v & 7,
  width: ((v >> 3) & 63) / 10,
  height: ((v >> 9) & 63) / 10,
  lift: ((v >> 15) & 511) / 10,
  ...((v >> 24) & 1 ? { band: true } : {}),
});

/** A house number plate: the size every plate has (m), its number and letter from the map. */
export const HOUSE_PLATE = { width: 0.36, height: 0.24 } as const;

export interface PlateLayout {
  /** 1..999; 0 a plate with no number the map gives (a generic one). */
  readonly number: number;
  /** 0 none, 1..26 a..z. */
  readonly letter: number;
  readonly lift: number;
}

/** Bits 0-9 the number, 10-14 the letter, 15-20 the lift (dm). */
export const plateVariant = (p: PlateLayout): number => (Math.max(0, Math.min(999, p.number)) & 1023) | ((p.letter & 31) << 10) | (dm(p.lift, 6) << 15);

export const plateLayout = (v: number): PlateLayout => ({
  number: v & 1023,
  letter: (v >> 10) & 31,
  lift: ((v >> 15) & 63) / 10,
});

/** The number and letter of `addr:housenumber` (`12`, `12A`, `5/7` takes the first, `12-14` the first), or null. */
export const parseHouseNumber = (v: string | undefined): { number: number; letter: number } | null => {
  const m = /^\s*(\d{1,3})\s*([a-zA-Z])?(?![a-zA-Z])/.exec(v ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1) return null;
  return {
    number: n,
    letter: m[2] ? m[2].toLowerCase().charCodeAt(0) - 96 : 0,
  };
};

/**
 * What a sticker may be stuck on, as the renderer draws it (`renderer/mapcity/prop-lamps.ts`,
 * `prop-street.ts`; `packages/engine/test/decal-models.test.ts` holds the two together): a box's faces (half sizes in the
 * host's frame, the faces a sticker may take: 0 +x, 1 -x, 2 +z, 3 -z) or a prism's (sides, its
 * radius at the foot `y0` and at `y1`, all its faces), and the heights a sticker's middle keeps to.
 */
export type StickerHost =
  | {
      readonly kind: StreetPropKind;
      readonly box: {
        readonly hx: number;
        readonly hz: number;
        readonly faces: readonly number[];
      };
      readonly low: number;
      readonly high: number;
    }
  | {
      readonly kind: StreetPropKind;
      readonly prism: {
        readonly sides: number;
        readonly y0: number;
        readonly r0: number;
        readonly y1: number;
        readonly r1: number;
      };
      readonly low: number;
      readonly high: number;
    };

/** In the order of their index in a sticker's variant. */
export const STICKER_HOSTS: readonly StickerHost[] = [
  // The square shaft 0.14 m; its front carries the LED strip.
  {
    kind: "lamp-modern-pole",
    box: { hx: 0.07, hz: 0.07, faces: [0, 1, 3] },
    low: 1.25,
    high: 1.9,
  },
  {
    kind: "lamp-road",
    prism: { sides: 8, y0: 0.3, r0: 0.11, y1: 8.5, r1: 0.07 },
    low: 1.25,
    high: 1.9,
  },
  {
    kind: "traffic-signal",
    prism: { sides: 8, y0: -0.1, r0: 0.07, y1: 3.3, r1: 0.07 },
    low: 1.5,
    high: 2.0,
  },
  {
    kind: "trolley-pole",
    prism: { sides: 8, y0: -0.2, r0: 0.14, y1: 7.8, r1: 0.1 },
    low: 1.25,
    high: 1.9,
  },
  // The cabinet's body 0.8 x 1.25 x 0.36 m; its amber lamp is at the right of the front, over the stickers.
  {
    kind: "street-cabinet",
    box: { hx: 0.4, hz: 0.18, faces: [0, 1, 2, 3] },
    low: 0.45,
    high: 0.8,
  },
];

/** The faces of a host a sticker may take. */
export const hostFaces = (h: StickerHost): readonly number[] => ("box" in h ? h.box.faces : Array.from({ length: h.prism.sides }, (_, k) => k));

/** A sticker: one of 8 designs, its host (`STICKER_HOSTS`), the face of it and the height of its middle (m, in 0.1 m steps). */
export interface StickerLayout {
  readonly design: number;
  readonly host: number;
  readonly face: number;
  readonly lift: number;
}

export const STICKER_DESIGNS = 8;
/** A sticker's size (m): narrower than an octagonal shaft's face of 0.07 m radius. */
export const STICKER = { width: 0.05, height: 0.07 } as const;

/** Bits 0-2 the design, 3-5 the host, 6-9 the face, 10-14 the lift (dm). */
export const stickerVariant = (s: StickerLayout): number => (s.design & 7) | ((s.host & 7) << 3) | ((s.face & 15) << 6) | (dm(s.lift, 5) << 10);

export const stickerLayout = (v: number): StickerLayout => ({
  design: v & 7,
  host: (v >> 3) & 7,
  face: (v >> 6) & 15,
  lift: ((v >> 10) & 31) / 10,
});

/**
 * Where a sticker's face is in its host's frame (x right, z front, before the host's yaw): the
 * outward normal and how far the face's plane stands from the host's axis at height `y`.
 */
export const hostFace = (h: StickerHost, face: number, y: number): { nx: number; nz: number; out: number } => {
  if ("box" in h) {
    const [nx, nz] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][face & 3]!;
    return { nx: nx!, nz: nz!, out: nx !== 0 ? h.box.hx : h.box.hz };
  }
  const p = h.prism;
  // The prism's k-th face looks along the middle of its corners (`MeshSink.prism`); its plane is the apothem.
  const a = ((face % p.sides) + 0.5) * ((Math.PI * 2) / p.sides);
  const t = (y - p.y0) / (p.y1 - p.y0);
  const r = p.r0 + (p.r1 - p.r0) * t;
  return {
    nx: Math.cos(a),
    nz: Math.sin(a),
    out: r * Math.cos(Math.PI / p.sides),
  };
};

/**
 * A gully grate at the kerb (local x along the kerb, z towards it): its size (m) and the heights
 * of its underside and top over the terrain under its middle, which the carriageway is draped
 * `SURFACE_LIFT.road` over.
 */
export const DRAIN_GRATE = {
  length: 0.5,
  width: 0.3,
  bottom: 0.094,
  top: 0.112,
} as const;

/** A grate: one of two castings and the fall of the road under it along local x and z (m per m, in 1 % steps up to 15 %). */
export interface GrateLayout {
  readonly casting: number;
  readonly slopeX: number;
  readonly slopeZ: number;
}

export const MAX_GRATE_SLOPE = 0.15;

const pct = (s: number): number => Math.max(-15, Math.min(15, Math.round(s * 100))) + 16;

/** Bit 0 the casting, 1-5 the fall along x (+16, %), 6-10 across (+16, %). */
export const grateVariant = (g: GrateLayout): number => (g.casting & 1) | (pct(g.slopeX) << 1) | (pct(g.slopeZ) << 6);

export const grateLayout = (v: number): GrateLayout => ({
  casting: v & 1,
  slopeX: (((v >> 1) & 31) - 16) / 100,
  slopeZ: (((v >> 6) & 31) - 16) / 100,
});
