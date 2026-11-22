import { type Piece, type PieceKind, box, piece } from "./plan";
import { ALCHEMIA_UNITS, FOODHALL_CEILING, FOODHALL_FLOOR, OYAJI_BACK_ROOM, UNIT_WALL, type UnitDef } from "./units";

/*
 * The food hall's kitchens on P3 (ADR-0093 O3, `docs/zasady-lokacji.md` §2-§5): behind each open
 * unit's counter its keeper's line along the back (a worktop solid to the hip), the stove, griddle,
 * wok burner or coffee machine on it by the unit's kitchen, the pots and their steam, a hood with its
 * duct up to the slab, a fridge, a menu screen over the line, crates stacked by the counter's end, the
 * till on the counter with its cable down from the slab and a cup by it; Oyaji's racks of guns and his
 * stock in the back room, Sachiko's shelves of everything. Technique next to poverty (§3): the menu's
 * screen over cartons, the till's cable taped to the hood. Each keeper's mark of just having been at
 * it (§5): the steam off a pot, a cup still warm. Solid only the worktops, the fridges and the racks
 * (a body's height); the rest drawn. The shut ones are dark behind their shutters.
 */

const F = FOODHALL_FLOOR;
const C = FOODHALL_CEILING;

/** A unit's frame: `u` along its open side, `v` in from it, as world boxes. */
const frame = (q: UnitDef) => {
  const r = q.rect;
  const across = q.open === "e" || q.open === "w";
  const w = across ? r.maxZ - r.minZ : r.maxX - r.minX;
  const d = across ? r.maxX - r.minX : r.maxZ - r.minZ;
  const at = (u: number, v: number) => {
    if (q.open === "s") return { x: r.minX + u, z: r.minZ + v };
    if (q.open === "n") return { x: r.maxX - u, z: r.maxZ - v };
    if (q.open === "e") return { x: r.maxX - v, z: r.minZ + u };
    return { x: r.minX + v, z: r.maxZ - u };
  };
  const put = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, kind: PieceKind, solid = false): Piece => {
    const [a, b] = [at(u0, v0), at(u1, v1)];
    return piece(box(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), F + y0, F + y1), kind, true, solid);
  };
  return { w, d, put };
};

/**
 * A round thing of a kitchen drawn by the rooms' detail (ADR-0098, comic realism: a pot is round, not a box): its
 * model's key and the box it stands in (`foodhall-detail.ts` stands the model on the box's foot, in its middle).
 */
export interface KitchenRound {
  readonly key: "rd-fh-pot" | "rd-fh-bowls" | "rd-fh-teacup" | "rd-fh-gas";
  readonly box: Piece["box"];
}

/** What stands on a kitchen's line by its kind: the cooker's box and what is on it. */
const COOKER: Readonly<Record<string, { readonly kind: PieceKind; readonly h: number; readonly pots: number }>> = {
  ramen: { kind: "machine", h: 0.05, pots: 3 },
  okonomiyaki: { kind: "machine", h: 0.08, pots: 1 },
  "umbrellas-tea": { kind: "machine", h: 0.45, pots: 2 },
  coffee: { kind: "machine", h: 0.5, pots: 0 },
  thai: { kind: "machine", h: 0.05, pots: 2 },
  greek: { kind: "machine", h: 0.9, pots: 1 },
  wok: { kind: "machine", h: 0.06, pots: 2 },
};

/** One food unit's kitchen: its pieces, and its round things for the rooms' detail. */
const kitchen = (q: UnitDef): { readonly pieces: Piece[]; readonly round: KitchenRound[] } => {
  const { w, d, put } = frame(q);
  const W = UNIT_WALL;
  const line = d - 0.65;
  const cook = COOKER[q.cuisine] ?? COOKER.thai!;
  const round: KitchenRound[] = [
    // The pots on the cooker, the stack of bowls at the line's far end, the gas bottles by it, the cup by the till.
    ...Array.from({ length: cook.pots }, (_, i): KitchenRound => ({ key: "rd-fh-pot", box: put(0.7 + i * 0.42, 1.05 + i * 0.42, line + 0.12, line + 0.47, 0.9 + cook.h, 1.2 + cook.h - i * 0.05, "goods").box })),
    { key: "rd-fh-bowls", box: put(w - 0.65, w - 0.35, line + 0.15, line + 0.45, 0.9, 1.1, "cup").box },
    { key: "rd-fh-gas", box: put(w - 0.65, w - 0.35, line - 0.4, line - 0.1, -0.05, 0.9, "machine").box },
    { key: "rd-fh-gas", box: put(w - 1.0, w - 0.7, line - 0.4, line - 0.1, -0.05, 0.9, "machine").box },
    { key: "rd-fh-teacup", box: put(w - 1.55, w - 1.47, 0.35, 0.43, 1.0, 1.11, "cup").box },
  ];
  const out: Piece[] = [
    // The line along the back, solid to the hip.
    put(W + 0.05, w - W - 0.05, line, d - 0.02, -0.05, 0.9, "counter", true),
    // The cooker on it and the steam off its first pot (§5; the pots are round, `round`).
    put(0.6, 1.9, line + 0.05, d - 0.08, 0.9, 0.9 + cook.h, cook.kind),
    put(0.85, 0.9, line + 0.27, line + 0.32, 1.25 + cook.h, 1.7 + cook.h, "steam"),
    // The hood over the cooker, its duct up the back to the slab.
    put(0.45, 2.05, line - 0.15, d - 0.02, 2.0, 2.35, "duct"),
    put(1.05, 1.45, d - 0.42, d - 0.02, 2.35, C - F, "duct"),
    // Prep space: cartons of stock at the line's far end (a stack of bowls by them, `round`).
    put(w - 1.3, w - 0.75, line + 0.08, d - 0.1, 0.9, 1.15, "carton"),
    // The menu over the line: three screens in dark bezels hung off the slab, their light on the keeper's back.
    ...[0, 1, 2].flatMap((i) => {
      const u0 = 0.5 + i * 0.85;
      return [
        put(u0, u0 + 0.75, line - 0.09, line - 0.05, 1.6, 2.1, "machine"),
        put(u0 + 0.04, u0 + 0.71, line - 0.1, line - 0.09, 1.64, 2.06, "display"),
        put(u0 + 0.36, u0 + 0.39, line - 0.08, line - 0.06, 2.1, C - F, "cable"),
      ];
    }),
    // A bucket of scraps by the gas bottles (`round`) at the line's far end.
    put(w - 1.45, w - 1.1, line - 0.4, line - 0.05, -0.05, 0.4, "carton"),
    // A fridge before the line's start by the side partition.
    put(W + 0.05, W + 0.75, line - 0.75, line - 0.05, -0.05, 1.9, "machine", true),
    // The till on the counter, its cable down from the slab (a cup by it, `round`); cartons stacked by the counter's end.
    put(w - 1.2, w - 0.85, 0.25, 0.55, 1.0, 1.05, "machine"),
    put(w - 1.18, w - 0.87, 0.38, 0.42, 1.05, 1.32, "display"),
    put(w - 1.04, w - 1.01, 0.4, 0.43, 1.32, C - F, "cable"),
    put(W + 0.1, W + 0.6, 2.0, 2.5, -0.05, 0.5, "carton"),
    put(W + 0.15, W + 0.55, 2.05, 2.45, 0.5, 0.85, "carton"),
    // A light strip over the keeper under the slab.
    put(0.4, w - 0.4, 1.2, 1.3, C - F - 0.06, C - F - 0.02, "lamp"),
  ];
  return { pieces: out, round };
};

/** Sachiko's kiosk: shelves of everything along its back and sides (solid), a lamp under its roof, the cartons she sells from. */
const kiosk = (q: UnitDef): Piece[] => {
  const { w, d, put } = frame(q);
  const W = UNIT_WALL;
  const out: Piece[] = [put(W + 0.05, w - W - 0.05, d - 0.45, d - 0.02, -0.05, 2.0, "rack", true)];
  for (let y = 0.3; y < 1.9; y += 0.4) {
    out.push(put(W + 0.1, w - W - 0.1, d - 0.43, d - 0.04, y, y + 0.03, "rack"));
    for (let u = W + 0.15, i = 0; u < w - W - 0.35; u += 0.32, i++) if ((i * 7 + Math.round(y * 10)) % 5 !== 0) out.push(put(u, u + 0.24, d - 0.4, d - 0.08, y + 0.03, y + 0.17 + ((i * 3) % 4) * 0.04, "goods"));
  }
  out.push(
    put(w - W - 0.6, w - W - 0.1, 1.6, 2.2, -0.05, 0.9, "machine", true),
    put(0.5, w - 0.5, 1.6, 1.7, 2.3, 2.34, "lamp"),
    put(W + 0.1, W + 0.6, 1.8, 2.3, -0.05, 0.45, "carton"),
    put(1.22, 1.26, 0.32, 0.36, 1.14, 1.4, "steam"),
  );
  return out;
};

/** Oyaji's shop: racks of guns on his back partition (solid), a glass case, his stock in crates in the back room, a lamp. */
const arms = (q: UnitDef): Piece[] => {
  const { w, put } = frame(q);
  const back = OYAJI_BACK_ROOM.minX - UNIT_WALL - q.rect.minX;
  // South of the back room's door (its north end, `u` 0.4-1.6).
  const out: Piece[] = [put(1.8, w - 0.3, back - 0.45, back, -0.05, 2.2, "rack", true)];
  for (let y = 0.6; y < 2.1; y += 0.5) {
    out.push(put(1.85, w - 0.35, back - 0.4, back - 0.05, y, y + 0.03, "rack"));
    for (let u = 1.95, i = 0; u < w - 0.75; u += 0.55, i++) if ((i + Math.round(y * 2)) % 4 !== 0) out.push(put(u, u + 0.42, back - 0.3, back - 0.12, y + 0.05, y + 0.4, "goods"));
  }
  const r = OYAJI_BACK_ROOM;
  out.push(
    // A glass case of sights and grips along the glass by the counter's south end, clear of his flap and his stool.
    put(w - 0.65, w - 0.15, 2.2, 3.4, -0.05, 0.55, "counter", true),
    put(w - 0.6, w - 0.2, 2.25, 3.35, 0.97, 1.0, "vitrine"),
    put(1.0, 3.2, 1.9, 2.0, C - F - 0.06, C - F - 0.02, "lamp"),
    // The back room's crates, stacked, a lamp over them.
    piece(box(r.minX + 0.2, r.minX + 1.4, r.minZ + 0.2, r.minZ + 1.2, F - 0.05, F + 1.2), "carton", true),
    piece(box(r.minX + 1.6, r.maxX - 0.2, r.minZ + 0.2, r.minZ + 1.0, F - 0.05, F + 0.8), "carton", true),
    piece(box(r.minX + 0.5, r.maxX - 0.5, (r.minZ + r.maxZ) / 2, (r.minZ + r.maxZ) / 2 + 0.1, C - 0.06, C - 0.02), "lamp", true, false),
  );
  return out;
};

/** Every unit's fittings, in `ALCHEMIA_UNITS`' order: none behind a shutter. */
export const kitchenPieces = (): Piece[] =>
  ALCHEMIA_UNITS.flatMap((u) => (u.shut ? [] : u.id === "sachiko" ? kiosk(u) : u.id === "oyaji" ? arms(u) : kitchen(u).pieces));

/** Sachiko's and Oyaji's cups on their counters (Sachiko's steaming), as `kiosk` and `arms` had them. */
const keeperCup = (q: UnitDef): KitchenRound => {
  const { put } = frame(q);
  const b = q.id === "sachiko" ? put(1.2, 1.28, 0.3, 0.38, 1.0, 1.11, "cup").box : put(1.6, 1.68, 0.4, 0.48, 1.1, 1.21, "cup").box;
  return { key: "rd-fh-teacup", box: b };
};

/** The units' round things for the rooms' detail (`foodhall-detail.ts`), in `ALCHEMIA_UNITS`' order: none behind a shutter. */
export const KITCHEN_ROUND: readonly KitchenRound[] = ALCHEMIA_UNITS.flatMap((u) => (u.shut ? [] : u.id === "sachiko" || u.id === "oyaji" ? [keeperCup(u)] : kitchen(u).round));
