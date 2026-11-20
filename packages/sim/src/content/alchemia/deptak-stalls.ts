import { type ActivityId, type StreetPropItem, type Vec3, figureVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { LUBLIN_STREET_PROPS } from "../lublin";
import { groundY } from "../lublin/terrain";
import { type Piece, box, piece } from "./plan";

/*
 * The stalls of the deptak on Lubartowska (ADR-0074 T-324, C7 of the board 1:1, 20.11) dressed as
 * the board `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` has them: lit, full of goods, a
 * seller behind each counter and people before the kiosks. The stalls and kiosks themselves are the
 * map's furniture (`lublin-props.todo.json`, `lubartowska-deptak.*`); this adds what stands at them,
 * in the three layers of `docs/zasady-lokacji.md` §2: a stack of crates of produce between the
 * vegetable stalls (big objects), and on the counters crates of produce, buckets of flowers, holo
 * price tags over cardboard, a lamp under each canopy fed by a cable taped to the trolleybus's pole
 * (§3, the contrast of technique and poverty), cartons, flyers and the seller's tea still steaming
 * (§5, someone here a moment ago).
 * Pattern: the active frontage of a shopping street (J. Gehl, "Cities for People", 2010: "soft
 * edges", small units, goods out on the street, people lingering at them). Everything stands on the
 * deptak's old carriageway (its setts), off the footways, the parking lane w522482244, metro B's
 * way onto the deptak and the trolleybus's line (scan `deptak-stall-clear`).
 * The sellers are the game's still figures (ADR-0058), as the square's kiosks' (C5): the crowd's
 * standers of this chunk take its spots in an order of the seed's, which would leave a stall
 * without its seller in most games. The customers before the kiosks and stalls are the crowd's
 * spots (ADR-0060).
 */

const CHUNK = "krakowskie-2-1";
const cm = (v: number): number => Math.round(v * 100) / 100;

/** The deptak's stretch of Lubartowska (T-324, from Bajkowskiego to Olejna): its stalls and kiosks stand in this box. */
const DEPTAK_BOX = { minX: 436, maxX: 458, minZ: -10, maxZ: 43 } as const;
const onDeptak = (p: StreetPropItem): boolean => p.x > DEPTAK_BOX.minX && p.x < DEPTAK_BOX.maxX && p.z > DEPTAK_BOX.minZ && p.z < DEPTAK_BOX.maxZ;

/** The map's furniture of one kind on the deptak, south to north. */
const furniture = (kind: StreetPropItem["prop"]): StreetPropItem[] =>
  (LUBLIN_STREET_PROPS[CHUNK] ?? []).filter((p) => p.prop === kind && onDeptak(p)).sort((a, b) => a.z - b.z);

/** The market stalls (the flower stall, then the two of vegetables) and the kiosks (MPK, Ruch, the phone repair). */
export const DEPTAK_STALLS: readonly StreetPropItem[] = furniture("market-stall");
export const DEPTAK_KIOSKS: readonly StreetPropItem[] = furniture("kiosk");

/**
 * A point of a piece's frame (`furniture.ts`: x across, z out of its front, the counter's side) in
 * the world, and the facing of its front.
 */
const frame = (p: StreetPropItem, x: number, z: number): { readonly x: number; readonly z: number } => {
  const [c, s] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  return { x: cm(p.x + x * c + z * s), z: cm(p.z - x * s + z * c) };
};

/** A market stall's frame (`furniture.ts`): its counter 2.1 m long, 0.5 deep, 1.05 high at the front; its canopy on four posts 2.3 m. */
const STALL = { counterZ0: 0.3, counterZ1: 0.8, half: 1.05, top: 1.05, canopy: 2.3, post: 1, back: 0.7 } as const;

/** A stall's seller: behind its counter, facing out over it. */
export const stallSeller = (p: StreetPropItem): { readonly x: number; readonly z: number } => frame(p, 0.3, -0.15);

/** A box in a stall's frame from (x0, z0) to (x1, z1) (its quarter turns only), `y0` to `y1` over its foot. */
const inFrame = (p: StreetPropItem, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): ReturnType<typeof box> => {
  const a = frame(p, x0, z0);
  const b = frame(p, x1, z1);
  return box(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), cm(p.y + y0), cm(p.y + y1));
};

/** What lies on a stall's counter and hangs under its canopy: produce in crates (flowers on the first), a holo price tag, the lamp. */
const counterPieces = (p: StreetPropItem, i: number): Piece[] => {
  const T = STALL.top;
  const out: Piece[] = [];
  for (const x of [-0.7, 0, 0.7]) {
    out.push(piece(inFrame(p, x - 0.3, x + 0.3, 0.35, 0.75, T, T + 0.12), "crate", false, false));
    out.push(piece(inFrame(p, x - 0.26, x + 0.26, 0.39, 0.71, T + 0.12, T + 0.2), i === 0 ? "flower" : "goods", false, false));
  }
  // The price over the crates: a holo tag on a stick, beside a cardboard one.
  out.push(piece(inFrame(p, -0.45, -0.1, 0.78, 0.8, T + 0.3, T + 0.52), "holo", false, false));
  out.push(piece(inFrame(p, 0.35, 0.6, 0.79, 0.8, T + 0.2, T + 0.36), "carton", false, false));
  // The lamp under the canopy's middle.
  out.push(piece(inFrame(p, -0.15, 0.15, 0.05, 0.25, STALL.canopy - 0.18, STALL.canopy - 0.1), "lamp", false, false));
  return out;
};

/** The flower stall's buckets beside its counter (solid, knee high) and the seller's tea on the counter's end, steaming. */
const flowerPieces = (p: StreetPropItem): Piece[] => [
  piece(inFrame(p, -1.55, -1.2, 0.3, 0.65, 0, 0.4), "planter", false),
  piece(inFrame(p, -1.5, -1.25, 0.35, 0.6, 0.4, 0.65), "flower", false, false),
  piece(inFrame(p, -1.55, -1.2, -0.15, 0.2, 0, 0.35), "planter", false),
  piece(inFrame(p, -1.5, -1.25, -0.1, 0.15, 0.35, 0.6), "flower", false, false),
  piece(inFrame(p, 0.85, 0.93, 0.4, 0.48, STALL.top, STALL.top + 0.1), "cup", false, false),
  piece(inFrame(p, 0.87, 0.91, 0.42, 0.46, STALL.top + 0.12, STALL.top + 0.4), "steam", false, false),
  // Cartons stacked against its open back, on the setts.
  piece(inFrame(p, -0.6, 0, -1.2, -0.8, 0, 0.4), "carton", false),
  piece(inFrame(p, -0.5, -0.1, -1.15, -0.85, 0.4, 0.68), "carton", false),
];

/** The trolleybus's pole between the vegetable stalls (the map's), the lamps' power taped to it at this height. */
const POLE_TAP = 2.6;

/** The vegetable stalls' cable from the pole to each canopy's lamp, a flyer on the setts before each. */
const vegetablePieces = (p: StreetPropItem): Piece[] => {
  const pole = (LUBLIN_STREET_PROPS[CHUNK] ?? []).find((q) => q.prop === "trolley-pole" && Math.abs(q.z - p.z) < 3 && Math.abs(q.x - p.x) < 2);
  const out: Piece[] = [piece(inFrame(p, 0.2, 0.5, 1.1, 1.35, 0.003, 0.008), "paper", false, false)];
  if (!pole) return out;
  const y = cm(pole.y + POLE_TAP);
  const [z0, z1] = [Math.min(pole.z, p.z), Math.max(pole.z, p.z)];
  out.push(piece(box(cm(pole.x - 0.015), cm(pole.x + 0.015), z0, z1, y - 0.015, y + 0.015), "cable", false, false));
  out.push(piece(box(cm(Math.min(pole.x, p.x) - 0.015), cm(Math.max(pole.x, p.x) + 0.015), cm(p.z - 0.015), cm(p.z + 0.015), y - 0.015, y + 0.015), "cable", false, false));
  out.push(piece(box(cm(p.x - 0.015), cm(p.x + 0.015), cm(p.z - 0.015), cm(p.z + 0.015), cm(p.y + STALL.canopy - 0.1), y), "cable", false, false));
  return out;
};

/** Every drawn piece at the deptak's stalls. */
export const deptakStallPieces = (): Piece[] => [...DEPTAK_STALLS.flatMap((p, i) => [...counterPieces(p, i), ...(i === 0 ? flowerPieces(p) : vegetablePieces(p))]), ...stackPieces()];

/** A seller of the game's still figures behind each stall's counter. */
const sellers = (): StreetPropItem[] =>
  DEPTAK_STALLS.map((p, i) => {
    const s = stallSeller(p);
    return { prop: "figure", x: s.x, y: p.y, z: s.z, yaw: p.yaw, variant: figureVariant({ pose: i % 2 === 0 ? "hips" : "stand", body: i === 1 ? "b" : "a", seat: 0, look: 6 + i * 9 }) };
  });

/**
 * A stack of crates of produce between the two vegetable stalls, on the setts by the trolleybus's
 * pole: the stock waiting to go on the counters. Drawn crates (O4's), not the game's `market-goods`:
 * its furniture block by the deptak has no market goods, and one would cost the block a mesh and a
 * draw call more (the scene at Zielona 5A sees that block from afar, `npr-perf`).
 */
const stackPieces = (): Piece[] => {
  const [a, b] = [DEPTAK_STALLS[1], DEPTAK_STALLS[2]];
  if (!a || !b) return [];
  const [x, z, y] = [cm((a.x + b.x) / 2 + 0.05), cm((a.z + b.z) / 2 + 0.15), cm(Math.min(a.y, b.y))];
  const crate = (dz: number, k: number): Piece[] => [
    piece(box(x - 0.3, x + 0.3, cm(z + dz - 0.2), cm(z + dz + 0.2), cm(y + k * 0.3 - 0.05), cm(y + (k + 1) * 0.3)), "crate", false),
    piece(box(x - 0.26, x + 0.26, cm(z + dz - 0.16), cm(z + dz + 0.16), cm(y + (k + 1) * 0.3), cm(y + (k + 1) * 0.3 + 0.07)), "goods", false, false),
  ];
  return [...crate(-0.25, 0), ...crate(0.25, 0), ...crate(0, 1)];
};

/** The game's models at the deptak's stalls: the sellers. */
export const DEPTAK_PROPS: readonly StreetPropItem[] = sellers();

const spot = (at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]], group: string): CrowdSpot => ({ chunk: CHUNK, at, yaw, does, group });

/** A customer before a piece's front, `x` across and `z` out of it, facing it. */
const customer = (p: StreetPropItem, x: number, z: number, does: readonly [ActivityId, ...ActivityId[]], group: string): CrowdSpot => {
  const q = frame(p, x, z);
  return spot({ x: q.x, y: cm(groundY(q.x, q.z)), z: q.z }, p.yaw + Math.PI, does, group);
};

/**
 * The deptak's still crowd (ADR-0060): a customer at each kiosk's window (a ticket, a paper, a phone
 * to mend) and one at each vegetable stall. The flower stall and the food cart have the map's still
 * figures queueing (`props-figures.ts`), so none of the crowd's there.
 */
export const DEPTAK_CROWD: readonly CrowdSpot[] = [
  ...DEPTAK_KIOSKS.map((k, i) => customer(k, i === 1 ? -0.3 : 0.3, 1.65, i === 2 ? ["phone", "talk"] : ["talk"], `deptak-kiosk-${i}`)),
  // The second's on its south side: the drinks machines stand by its north one.
  ...DEPTAK_STALLS.slice(1).map((p, i) => customer(p, i === 0 ? -0.45 : 0.45, 1.3, i === 0 ? ["talk"] : ["phone", "talk"], `deptak-stall-${i + 1}`)),
];
