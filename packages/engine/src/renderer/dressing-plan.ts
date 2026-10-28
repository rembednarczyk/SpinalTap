import type { BlockFront, BlockSkin, Vec3 } from "@seki/core";
import { SIGN_COLORS, prng, seedOf } from "./city-kit-data";
import { DRESS_FLAG, MeshSink, type Rgba, hexColor } from "./mesh-sink";

/**
 * Procedural set dressing (ADR-0027): what turns collision boxes into a lived-in street when the
 * city kit does not draw them. Pure data from the blocks in view, no Babylon and no fixed
 * coordinates, so it dresses any district the content adds.
 */

/** A block as the dressing sees it: the view of a `block` prop and where it stands. */
export interface DressBlock {
  readonly center: Vec3;
  readonly size: Vec3;
  readonly material: "concrete" | "metal" | "asphalt" | "glass";
  readonly skin?: BlockSkin;
  readonly rungs?: number;
  readonly slope?: unknown;
}

/** A neon sign from the content: facade clutter keeps clear of it. */
export interface DressSign {
  readonly center: Vec3;
  readonly size: Vec3;
}

const PALETTE = {
  ledge: "#4b5260",
  ledgeDark: "#353a45",
  shopDark: "#0f1218",
  shutter: "#596171",
  ac: "#8b929b",
  acGrille: "#2b2f36",
  pipe: "#3e444f",
  iron: "#22262d",
  tank: "#6b5a4a",
  antenna: "#2a2e35",
  line: "#c9c2a0",
  lineYellow: "#d9a63a",
  bag: "#1b2420",
  bag2: "#121417",
  cardboard: "#8a6a45",
  cable: "#0d0f13",
  vending: "#c8ccd2",
  signBack: "#16181e",
  deckAsphalt: "#2a2d35",
  joint: "#1c1f25",
  jointPlate: "#5c6370",
  kerb: "#6a707a",
  girder: "#3a4049",
  stain: "#1d2026",
  puddle: "#16181f",
  awnings: ["#2c7d8c", "#8c2c3f", "#a8862d", "#3c4f8c"],
} as const;

const FLOOR = 3.2;

type Side = BlockFront;
const SIDES: readonly Side[] = ["x+", "x-", "z+", "z-"];
const NORMAL: Readonly<Record<Side, { x: number; z: number }>> = { "x+": { x: 1, z: 0 }, "x-": { x: -1, z: 0 }, "z+": { x: 0, z: 1 }, "z-": { x: 0, z: -1 } };

/** A building: tall, with rooms behind its walls (the same rule as the procedural windows). */
export const isBuilding = (b: Pick<DressBlock, "size" | "material">): boolean =>
  b.material !== "asphalt" && b.size.y >= 6 && Math.min(b.size.x, b.size.z) >= 3 && Math.max(b.size.x, b.size.z) < 40;

/** Something that hides a wall behind it: a building, an outer wall, a kiosk. */
const isBulk = (b: DressBlock): boolean => b.material !== "asphalt" && b.size.y >= 2.5 && Math.min(b.size.x, b.size.z) >= 0.3 && !b.rungs && !b.slope;

/**
 * An elevated road deck (the overpass): a slab at least a lane wide and long, its underside
 * clear of the street. It gets lanes, joints and kerbs on top and girders underneath.
 */
export const isRoadDeck = (b: DressBlock): boolean =>
  b.material === "concrete" && !b.slope && b.size.y >= 0.25 && b.size.y <= 1.8 && b.center.y - b.size.y / 2 >= 2.5 && Math.min(b.size.x, b.size.z) >= 6 && Math.max(b.size.x, b.size.z) >= 20;

const top = (b: DressBlock) => b.center.y + b.size.y / 2;
const bottom = (b: DressBlock) => b.center.y - b.size.y / 2;

/** Horizontal gap between two footprints; 0 when they touch or overlap. */
const gapXZ = (a: DressBlock, b: { center: Vec3; size: Vec3 }) =>
  Math.hypot(
    Math.max(0, Math.abs(a.center.x - b.center.x) - (a.size.x + b.size.x) / 2),
    Math.max(0, Math.abs(a.center.z - b.center.z) - (a.size.z + b.size.z) / 2),
  );

/**
 * Is this roof walked on (C8, ADR-0027)? Yes when a ladder ends on it or starts from it, or when
 * something stands on it (a parapet rail, a crate): content only puts those on roofs people
 * reach. Roof housings and tanks there would have no collision, so walked roofs stay clear.
 */
export const isWalkedRoof = (b: Pick<DressBlock, "center" | "size">, others: Iterable<DressBlock>): boolean => {
  const roof = b.center.y + b.size.y / 2;
  const self = { ...b, material: "concrete" as const };
  for (const o of others) {
    if (o.center === b.center) continue;
    const gap = gapXZ(self, o);
    if (o.rungs) {
      if (gap > 1.2) continue;
      if (Math.abs(bottom(o) - roof) < 0.3 || (top(o) >= roof - 0.1 && top(o) <= roof + 1.8)) return true;
      continue;
    }
    // Standing on the roof: its bottom at the roof, its centre over the footprint.
    if (Math.abs(bottom(o) - roof) < 0.15 && Math.abs(o.center.x - b.center.x) < b.size.x / 2 + 0.3 && Math.abs(o.center.z - b.center.z) < b.size.z / 2 + 0.3) return true;
  }
  return false;
};

/** World frame of one face of a box: point at (along, height above the block's bottom, out). */
interface Face {
  readonly side: Side;
  readonly n: { x: number; z: number };
  /** Turn for boxes whose local z points out of the face. */
  readonly rot: number;
  readonly width: number;
  readonly height: number;
  at(u: number, y: number, out: number): Vec3;
}

const faceOf = (b: DressBlock, side: Side): Face => {
  const n = NORMAL[side];
  const alongX = side === "z+" || side === "z-";
  const width = alongX ? b.size.x : b.size.z;
  const depth = alongX ? b.size.z : b.size.x;
  const base = bottom(b);
  // Along-face axis = local x of a box turned by `rot`: (cos r, -sin r) with r = atan2(nx, nz).
  const rot = Math.atan2(n.x, n.z);
  const ux = Math.cos(rot);
  const uz = -Math.sin(rot);
  return {
    side,
    n,
    rot,
    width,
    height: b.size.y,
    at: (u, y, out) => ({ x: b.center.x + n.x * (depth / 2 + out) + ux * u, y: base + y, z: b.center.z + n.z * (depth / 2 + out) + uz * u }),
  };
};

/** Is the strip `reach` metres in front of a face clear of other bulk? */
const faceOpen = (b: DressBlock, side: Side, others: readonly DressBlock[], reach: number): boolean => {
  const n = NORMAL[side];
  const alongX = side === "z+" || side === "z-";
  const shrink = 0.6;
  const probe = {
    center: { x: b.center.x + n.x * (b.size.x / 2 + reach / 2), y: b.center.y, z: b.center.z + n.z * (b.size.z / 2 + reach / 2) },
    size: { x: alongX ? b.size.x - 2 * shrink : reach - 0.05, y: b.size.y, z: alongX ? reach - 0.05 : b.size.z - 2 * shrink },
  };
  for (const o of others) {
    if (o === b || !isBulk(o) || top(o) < bottom(b) + 2.5 || bottom(o) > bottom(b) + 2) continue;
    const probeBlock = { ...probe, material: "concrete" as const };
    if (gapXZ(probeBlock, o) === 0) return false;
  }
  return true;
};

export interface DressingInput {
  /** Blocks to dress (one streaming chunk). */
  readonly blocks: readonly DressBlock[];
  /** Every block in the world right now: neighbours across chunk seams hide faces too. */
  readonly world: readonly DressBlock[];
  readonly signs: readonly DressSign[];
  /** The city kit draws skinned buildings: leave them bare (their facades come with the kit). */
  readonly kit: boolean;
}

const C = (hex: string, flag: number = DRESS_FLAG.solid): Rgba => hexColor(hex, flag);

/**
 * Builds the dressing of a set of blocks into one sink: facades (ledges, shop fronts, awnings,
 * AC units, pipes, fire escapes, neon blades), roof clutter on roofs nobody walks, overhead
 * cables where the content says a street is, road decks (lanes, joints, kerbs, studs, girders),
 * centre lines on long streets and puddles on asphalt. Deterministic per block.
 */
export const planDressing = (input: DressingInput): MeshSink => {
  const sink = new MeshSink();
  const near = (p: Vec3, pad: number) =>
    input.signs.some((s) => Math.abs(s.center.x - p.x) < s.size.x / 2 + pad && Math.abs(s.center.y - p.y) < s.size.y / 2 + pad && Math.abs(s.center.z - p.z) < s.size.z / 2 + pad);
  for (const b of input.blocks) {
    if (isBuilding(b) && input.kit && b.skin) {
      // The kit draws the facade; the street in front of it still gets its clutter.
      if (faceOpen(b, b.skin.front, input.world, 2.5)) dressKerb(sink, b, faceOf(b, b.skin.front));
      dressCables(sink, b);
    } else if (isBuilding(b)) dressBuilding(sink, b, input.world, near);
    else if (isRoadDeck(b)) dressDeck(sink, b);
    else if (b.material === "asphalt" && top(b) < 0.4) dressGround(sink, b);
  }
  return sink;
};

/**
 * Road paint in front of a facade whose street the content names: a dashed centre line half way
 * across, and a zebra crossing in front of shops. Facing rows paint the same line; it coincides.
 */
const dressStreetPaint = (sink: MeshSink, b: DressBlock): void => {
  const street = b.skin?.street;
  if (street === undefined || street < 6 || !b.skin) return;
  const f = faceOf(b, b.skin.front);
  const y = 0.012;
  for (let u = -f.width / 2 + 1; u < f.width / 2 - 1; u += 4) sink.box(f.at(u, y, street / 2), 2, 0.01, 0.14, C(PALETTE.line), { rotY: f.rot, bottom: false });
  if (b.skin.style !== "shop") return;
  for (let out = 1.2; out <= street - 1.2; out += 1.1) sink.box(f.at(0, y + 0.002, out), 3, 0.01, 0.55, C(PALETTE.line), { rotY: f.rot, bottom: false });
};

/** Power and data lines across the street the content names (`skin.street`). Kept with the kit too. */
const dressCables = (sink: MeshSink, b: DressBlock): void => {
  dressStreetPaint(sink, b);
  if (b.skin?.street === undefined || b.skin.street <= 2) return;
  const rand = prng(seedOf(b.center) ^ 0xc0b1e);
  const f = faceOf(b, b.skin.front);
  const count = 2 + Math.floor(rand() * 2) + (f.width > 14 ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const u = (rand() - 0.5) * f.width * 0.85;
    const y = Math.min(b.size.y - 1, 6.5 + rand() * 6);
    sink.cable(f.at(u, y, 0.05), f.at(u + (rand() - 0.5) * 7, y + (rand() - 0.5) * 2.5, b.skin.street), 0.7 + rand() * 1.2, C(PALETTE.cable));
  }
};

/** At the foot of a front: a vending machine now and then, bag piles and a box. Kept with the kit too. */
const dressKerb = (sink: MeshSink, b: DressBlock, f: Face): void => {
  const rand = prng(seedOf(b.center) ^ 0xb1a5);
  const w = f.width;
  if (rand() < 0.3 && w > 6) {
    const u = (rand() - 0.5) * (w - 3);
    sink.box(f.at(u, 0.95, 0.4), 0.8, 1.9, 0.75, C(PALETTE.vending), { rotY: f.rot });
    sink.box(f.at(u, 1.15, 0.79), 0.55, 1.2, 0.03, C("#9fe8ff", DRESS_FLAG.lit), { rotY: f.rot });
  }
  if (rand() < 0.45) {
    const u = (rand() - 0.5) * (w - 2);
    for (let i = 0; i < 4; i++) {
      sink.box(f.at(u + (rand() - 0.5) * 1.1, 0.24, 0.5 + rand() * 0.6), 0.6, 0.48, 0.55, C(rand() < 0.5 ? PALETTE.bag : PALETTE.bag2), { rotY: rand() * 3, bottom: false });
    }
    sink.box(f.at(u + 0.9, 0.22, 0.45), 0.6, 0.45, 0.5, C(PALETTE.cardboard), { rotY: f.rot + rand(), bottom: false });
  }
};

const dressBuilding = (sink: MeshSink, b: DressBlock, world: readonly DressBlock[], onSign: (p: Vec3, pad: number) => boolean): void => {
  const rand = prng(seedOf(b.center) ^ 0x5eed);
  const open = SIDES.filter((s) => faceOpen(b, s, world, 2.5));
  const front: Side | null = b.skin?.front ?? SIDES.filter((s) => faceOpen(b, s, world, 10))[0] ?? open[0] ?? null;
  const tall = b.size.y;
  for (const side of open) {
    const f = faceOf(b, side);
    const isFront = side === front;
    const w = f.width;
    // Floor ledges every third floor and a heavy cornice at the roofline.
    for (let y = FLOOR * 3; y < tall - 1; y += FLOOR * 3) sink.box(f.at(0, y, 0.11), w, 0.14, 0.22, C(PALETTE.ledge), { rotY: f.rot });
    sink.box(f.at(0, tall - 0.18, 0.25), w + 0.3, 0.35, 0.5, C(PALETTE.ledgeDark), { rotY: f.rot });
    if (isFront) {
      // Ground floor: recessed shop fronts with shutters and awnings.
      const shops = Math.max(1, Math.floor(w / 5));
      for (let i = 0; i < shops; i++) {
        const u = -w / 2 + ((i + 0.5) * w) / shops;
        const sw = Math.min(3.6, w / shops - 0.6);
        const shut = rand() < 0.5;
        sink.box(f.at(u, 1.25, 0.03), sw, 2.5, 0.06, C(shut ? PALETTE.shutter : PALETTE.shopDark), { rotY: f.rot });
        if (shut) for (let y = 0.3; y < 2.4; y += 0.28) sink.box(f.at(u, y, 0.07), sw, 0.03, 0.04, C(PALETTE.ledgeDark), { rotY: f.rot });
        else sink.box(f.at(u, 1.6, 0.07), sw - 0.3, 1.2, 0.02, C(rand() < 0.5 ? "#ffb36a" : "#7fe8ff", DRESS_FLAG.lit), { rotY: f.rot });
        if (rand() < 0.75) {
          const color = PALETTE.awnings[Math.floor(rand() * PALETTE.awnings.length)] ?? PALETTE.awnings[0];
          // Local x out of the wall, tilted down away from it.
          sink.box(f.at(u, 2.95, 0.62), 1.3, 0.06, sw + 0.4, C(color), { rotY: f.rot - Math.PI / 2, tilt: -0.32 });
        }
      }
      dressKerb(sink, b, f);
      // A neon blade sign out of the facade, lit, in the city's sign colours.
      if (tall > 8 && rand() < 0.65) {
        const h = 2.4 + rand() * 1.6;
        const y = 4.4 + h / 2 + rand() * 1.4;
        const u = (rand() - 0.5) * (w - 3);
        const at = f.at(u, y, 0.75);
        if (y + h / 2 < tall - 0.6 && !onSign(at, 1)) {
          const color = SIGN_COLORS[Math.floor(rand() * SIGN_COLORS.length)] ?? "#ff2e88";
          sink.box(at, 0.12, h, 1.0, C(PALETTE.signBack), { rotY: f.rot });
          for (const side2 of [-1, 1]) {
            const o = f.at(u, y, 0.75);
            const ux = Math.cos(f.rot) * 0.07 * side2;
            const uz = -Math.sin(f.rot) * 0.07 * side2;
            const c = { x: o.x + ux, y: o.y, z: o.z + uz };
            // Tube outline and three bars of "letters".
            sink.box(c, 0.02, h - 0.1, 0.06, C(color, DRESS_FLAG.lit), { rotY: f.rot, uv2: [0, 0] });
            for (let k = 0; k < 3; k++) {
              sink.box({ x: c.x, y: c.y - h / 3 + (k * h) / 3, z: c.z }, 0.02, h / 5, 0.5, C(color, DRESS_FLAG.lit), { rotY: f.rot });
            }
          }
          sink.box(f.at(u, y + h / 2 + 0.25, 0.4), 0.06, 0.06, 0.8, C(PALETTE.pipe), { rotY: f.rot });
        }
      }
    } else {
      // Plinth along the bottom of side walls.
      sink.box(f.at(0, 0.3, 0.04), w, 0.6, 0.08, C(PALETTE.ledgeDark), { rotY: f.rot, bottom: false });
    }
    // AC units hanging under the windows.
    const acs = Math.round((w * tall) / (isFront ? 70 : 110) * (0.6 + rand() * 0.8));
    for (let i = 0; i < acs; i++) {
      const u = -w / 2 + 1 + rand() * Math.max(0.1, w - 2);
      const floor = 1 + Math.floor(rand() * Math.max(1, (tall - 4) / FLOOR));
      const y = floor * FLOOR + 0.9;
      if (y > tall - 1.5 || onSign(f.at(u, y, 0.3), 0.8)) continue;
      sink.box(f.at(u, y, 0.28), 0.85, 0.55, 0.55, C(PALETTE.ac), { rotY: f.rot });
      sink.box(f.at(u, y, 0.57), 0.6, 0.4, 0.04, C(PALETTE.acGrille), { rotY: f.rot });
    }
    // Drain pipe down one edge.
    const pu = (rand() < 0.5 ? -1 : 1) * (w / 2 - 0.4);
    sink.box(f.at(pu, tall / 2, 0.12), 0.14, tall, 0.14, C(PALETTE.pipe), { rotY: f.rot, bottom: false });
    // Fire escape on taller buildings.
    if (tall > 14 && rand() < (isFront ? 0.5 : 0.35)) {
      const eu = (rand() - 0.5) * Math.max(0, w - 4);
      for (let y = 6.4; y < tall - 2; y += FLOOR) {
        sink.box(f.at(eu, y, 0.5), 2.6, 0.06, 1.0, C(PALETTE.iron), { rotY: f.rot });
        sink.box(f.at(eu, y + 0.45, 1.0), 2.6, 0.9, 0.04, C(PALETTE.iron), { rotY: f.rot });
        sink.box(f.at(eu + 0.6, y + 1.6, 0.5), 0.85, 0.04, 0.12, C(PALETTE.iron), { rotY: f.rot - Math.PI / 2, tilt: 0.85 });
      }
    }
  }
  dressCables(sink, b);
  // Roof: a water tank or an antenna cluster, unless people walk there (C8).
  if (isWalkedRoof(b, world)) return;
  const roofY = top(b);
  const rx = (rand() - 0.5) * b.size.x * 0.5;
  const rz = (rand() - 0.5) * b.size.z * 0.5;
  if (rand() < 0.5) {
    const c = { x: b.center.x + rx, y: roofY + 1.2, z: b.center.z + rz };
    sink.prism(c, 1.1, 2.2, 10, C(PALETTE.tank), false);
    sink.prism({ x: c.x, y: c.y + 2.2, z: c.z }, 1.2, 0.8, 10, C(PALETTE.tank), true, 0.02);
    for (const [dx, dz] of [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ] as const) {
      sink.box({ x: c.x + dx, y: roofY + 0.6, z: c.z + dz }, 0.1, 1.2, 0.1, C(PALETTE.iron), { bottom: false });
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const h = 3 + rand() * 4;
      sink.box({ x: b.center.x + rx + (rand() - 0.5) * 4, y: roofY + h / 2, z: b.center.z + rz + (rand() - 0.5) * 4 }, 0.07, h, 0.07, C(PALETTE.antenna), { bottom: false });
    }
  }
};

/**
 * Road deck (C7): asphalt between low kerbs, solid edge lines, dashed lane lines, expansion
 * joints with steel finger plates, amber studs, and two girders with cross beams underneath.
 */
const dressDeck = (sink: MeshSink, b: DressBlock): void => {
  const alongX = b.size.x >= b.size.z;
  const L = alongX ? b.size.x : b.size.z;
  const W = alongX ? b.size.z : b.size.x;
  const y0 = top(b);
  const rot = alongX ? 0 : Math.PI / 2;
  // Point on the deck: s along its length from the centre, t across it.
  const at = (s: number, t: number, y: number): Vec3 => (alongX ? { x: b.center.x + s, y, z: b.center.z + t } : { x: b.center.x + t, y, z: b.center.z + s });
  const kerb = 0.45;
  const inner = W / 2 - kerb;
  sink.box(at(0, 0, y0 + 0.006), L - 0.1, 0.012, 2 * inner, C(PALETTE.deckAsphalt, DRESS_FLAG.wet), { rotY: rot, bottom: false });
  for (const side of [-1, 1]) {
    sink.box(at(0, side * (W / 2 - kerb / 2), y0 + 0.09), L, 0.18, kerb - 0.05, C(PALETTE.kerb), { rotY: rot, bottom: false });
    // Solid edge line just inside the kerb.
    sink.box(at(0, side * (inner - 0.35), y0 + 0.016), L - 0.4, 0.008, 0.15, C(PALETTE.line), { rotY: rot, bottom: false });
  }
  const lanes = Math.max(2, Math.floor((2 * inner - 0.8) / 3.4));
  const lane = (2 * inner - 0.7) / lanes;
  for (let k = 1; k < lanes; k++) {
    const t = -inner + 0.35 + k * lane;
    const centre = k === lanes / 2;
    if (centre) {
      // Double yellow down the middle of a two-way deck.
      for (const o of [-0.12, 0.12]) sink.box(at(0, t + o, y0 + 0.016), L - 0.4, 0.008, 0.12, C(PALETTE.lineYellow), { rotY: rot, bottom: false });
      continue;
    }
    for (let s = -L / 2 + 2; s < L / 2 - 3; s += 9) sink.box(at(s + 1.5, t, y0 + 0.016), 3, 0.008, 0.14, C(PALETTE.line), { rotY: rot, bottom: false });
  }
  // Amber studs along the edge lines.
  for (let s = -L / 2 + 1.5; s < L / 2 - 1; s += 6) {
    for (const side of [-1, 1]) sink.box(at(s, side * (inner - 0.6), y0 + 0.03), 0.16, 0.035, 0.12, C("#ffb000", DRESS_FLAG.lit), { rotY: rot, bottom: false });
  }
  // Expansion joints: a dark gap with two steel plates, kerb to kerb.
  for (let s = -L / 2 + 12; s < L / 2 - 4; s += 12) {
    sink.box(at(s, 0, y0 + 0.02), 0.28, 0.012, 2 * inner, C(PALETTE.joint), { rotY: rot, bottom: false });
    for (const o of [-0.24, 0.24]) sink.box(at(s + o, 0, y0 + 0.018), 0.16, 0.012, 2 * inner, C(PALETTE.jointPlate), { rotY: rot, bottom: false });
  }
  // Tyre wear and oil stains in the lanes.
  const rand = prng(seedOf(b.center));
  for (let i = 0; i < Math.floor(L / 6); i++) {
    const s = (rand() - 0.5) * (L - 4);
    const t = (rand() - 0.5) * (2 * inner - 2);
    sink.disc(at(s, t, y0 + 0.014), 0.4 + rand() * 0.9, 0.3 + rand() * 0.5, 10, C(PALETTE.stain, DRESS_FLAG.wet));
  }
  // Under the deck: two girders along it and cross beams.
  const yb = bottom(b);
  for (const side of [-1, 1]) sink.box(at(0, side * W * 0.28, yb - 0.3), L - 0.4, 0.6, 0.45, C(PALETTE.girder), { rotY: rot });
  for (let s = -L / 2 + 3; s < L / 2 - 2; s += 9) sink.box(at(s, 0, yb - 0.2), 0.35, 0.4, W - 1, C(PALETTE.girder), { rotY: rot });
};

/** Wet asphalt: puddles that catch the lights and, on long narrow streets, a dashed centre line. */
const dressGround = (sink: MeshSink, b: DressBlock): void => {
  const rand = prng(seedOf(b.center) ^ 0xa5a5);
  const y = top(b) + 0.008;
  const area = b.size.x * b.size.z;
  const count = Math.min(18, Math.floor(area / 110));
  for (let i = 0; i < count; i++) {
    const x = b.center.x + (rand() - 0.5) * (b.size.x - 2);
    const z = b.center.z + (rand() - 0.5) * (b.size.z - 2);
    const r = 0.7 + rand() * 1.4;
    sink.disc({ x, y, z }, r * (1 + rand()), r, 14, C(PALETTE.puddle, DRESS_FLAG.wet));
  }
  const long = Math.max(b.size.x, b.size.z);
  const short = Math.min(b.size.x, b.size.z);
  if (long / short < 2.5 || short < 6) return;
  const alongX = b.size.x >= b.size.z;
  for (let s = -long / 2 + 3; s < long / 2 - 2; s += 4) {
    const p = alongX ? { x: b.center.x + s, y: y + 0.002, z: b.center.z } : { x: b.center.x, y: y + 0.002, z: b.center.z + s };
    sink.box(p, alongX ? 2 : 0.14, 0.01, alongX ? 0.14 : 2, C(PALETTE.line), { bottom: false });
  }
};
