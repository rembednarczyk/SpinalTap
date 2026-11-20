import type { StreetPropItem } from "@seki/core";
import { type Piece, box, piece } from "./plan";
import { roofHash } from "./roof-garden";
import { ROOF_TABLES, ROOF_Y } from "./roof-plan";

/*
 * The green roof's other two layers (ADR-0093 O4, `docs/zasady-lokacji.md` §2, §3, §5): the roof's
 * services in its east part (the building's air handler with its fans, rows of solar panels, a mast
 * with a dish and a red light, cables taped across the roof to the north-east core) beside the
 * residents' wild garden (vegetable crates, a line of washing over them, a camping chair with cans
 * and a radio), and what somebody left a moment ago (a cigarette burning in an ashtray by the chair,
 * a steaming cup and an open lunch box on the picnic table, a watering can tipped over in its
 * puddle). Solid where somebody stops: the air handler, the panels' racks, the mast, the crates,
 * the washing's posts, the chair; the small things drawn only, near (the inside's mesh).
 */

const R = ROOF_Y;
/** A small thing, drawn near only. */
const thing = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, kind: Piece["kind"]): Piece => piece(box(x0, x1, z0, z1, y0, y1), kind, true, false);

/** The air handler in the south-east corner: its box, fans on top, a duct into the roof, its lights. */
export const AIR_HANDLER = { x0: 432.3, x1: 435.8, z0: 33.0, z1: 35.6, top: 1.6 } as const;
const airHandler = (): Piece[] => {
  const a = AIR_HANDLER;
  return [
    piece(box(a.x0, a.x1, a.z0, a.z1, R - 0.05, R + a.top), "machine", false),
    piece(box(a.x0 + 0.35, a.x0 + 1.55, a.z0 + 0.7, a.z0 + 1.9, R + a.top, R + a.top + 0.08), "fan", false, false),
    piece(box(a.x1 - 1.55, a.x1 - 0.35, a.z0 + 0.7, a.z0 + 1.9, R + a.top, R + a.top + 0.08), "fan", false, false),
    piece(box(a.x0 - 0.7, a.x0, a.z0 + 1.0, a.z0 + 1.6, R - 0.05, R + 0.9), "duct", false),
    // A red fault light and a lit panel on its north face: the expensive machine on a roof of crates (§3).
    thing(a.x0 + 0.4, a.x0 + 0.52, a.z1, a.z1 + 0.03, R + 1.2, R + 1.32, "error"),
    thing(a.x0 + 0.7, a.x0 + 1.2, a.z1, a.z1 + 0.03, R + 1.0, R + 1.35, "display"),
  ];
};

/** The solar panels' rows north of it: racks with the panel sloping up to the north, solid to its top. */
export const PANEL_ROWS: readonly { readonly z0: number; readonly z1: number }[] = [
  { z0: 37.6, z1: 38.8 },
  { z0: 40.2, z1: 41.4 },
  { z0: 42.8, z1: 44.0 },
  { z0: 45.4, z1: 46.6 },
];
export const PANELS = { x0: 433.0, x1: 435.9, low: 0.3, high: 1.0 } as const;
const panels = (): Piece[] => PANEL_ROWS.map((r) => piece(box(PANELS.x0, PANELS.x1, r.z0, r.z1, R - 0.05, R + PANELS.high), "panel", false));

/** The mast with its dish and its red light, under the gallery's height (13.5). */
export const MAST = { x: 434.8, z: 48.3, top: 2.65 } as const;
const mast = (): Piece[] => [
  piece(box(MAST.x - 0.08, MAST.x + 0.08, MAST.z - 0.08, MAST.z + 0.08, R - 0.05, R + MAST.top), "mast", false),
  piece(box(MAST.x - 0.06, MAST.x + 0.04, MAST.z - 0.38, MAST.z + 0.38, R + 1.75, R + 2.5), "mast", false, false),
  piece(box(MAST.x - 0.06, MAST.x + 0.06, MAST.z - 0.06, MAST.z + 0.06, R + MAST.top, R + MAST.top + 0.1), "beacon", false, false),
];

/** A cable flat on the roof from (x0, z0) to (x1, z1), along x or z, with tape round it here and there. */
const cable = (x0: number, z0: number, x1: number, z1: number): Piece[] => {
  const w = 0.03;
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const out = [thing(Math.min(x0, x1) - w, Math.max(x0, x1) + w, Math.min(z0, z1) - w, Math.max(z0, z1) + w, R, R + 0.03, "cable")];
  const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  for (let s = 1.7; s < len; s += 3.1) {
    const [x, z] = along ? [Math.min(x0, x1) + s, z0] : [x0, Math.min(z0, z1) + s];
    out.push(thing(x - (along ? 0.06 : 0.05), x + (along ? 0.06 : 0.05), z - (along ? 0.05 : 0.06), z + (along ? 0.05 : 0.06), R, R + 0.04, "paper"));
  }
  return out;
};
/** From the air handler and the panels north past the garden to the north-east core's house, and to the mast. */
const cables = (): Piece[] => [
  ...cable(432.1, 35.7, 432.1, 49.5),
  // Round the meadow's west end, between it and the lift's kiosk, to the core's house.
  ...cable(432.1, 49.5, 431.7, 49.5),
  ...cable(431.7, 49.5, 431.7, 54.4),
  ...PANEL_ROWS.flatMap((r) => cable(432.1, (r.z0 + r.z1) / 2, PANELS.x0, (r.z0 + r.z1) / 2)),
  ...cable(432.1, MAST.z, MAST.x - 0.1, MAST.z),
];

/** The residents' vegetable crates: two columns of wooden crates a hand apart (no way between), the washing over the gap. */
export const CRATES = { cols: [[428.1, 429.35], [429.75, 431.0]], z0: 40.2, every: 0.8, count: 8, high: 0.42 } as const;
export const WASHING = { x: 429.55, z0: 39.85, z1: 46.95, line: 1.95 } as const;

const crates = (): Piece[] => {
  const out: Piece[] = [];
  CRATES.cols.forEach(([x0, x1]) => {
    for (let i = 0; i < CRATES.count; i++) {
      const z = CRATES.z0 + i * CRATES.every;
      out.push({ ...piece(box(x0, x1, z + 0.04, z + CRATES.every - 0.04, R - 0.05, R + CRATES.high), "crate", true), inside: true });
      // What grows in it, by the hash: a crate of lettuce heads in two rows, or of tomatoes on stakes with their fruit (`flower`), or seedlings in a carton.
      const h = roofHash(x0, z);
      const zc = z + CRATES.every / 2;
      const top = R + CRATES.high - 0.03;
      if (h < 0.5) {
        for (const u of [0.22, 0.5, 0.78]) for (const v of [-0.15, 0.15]) {
          const x = x0 + (x1 - x0) * u;
          const s = 0.07 + 0.03 * roofHash(x + v, zc);
          out.push(thing(x - s, x + s, zc + v - s, zc + v + s, top, top + 0.1 + 0.06 * roofHash(zc, x + v), "green"));
        }
      } else if (h < 0.85) {
        for (const u of [0.3, 0.7]) {
          const x = x0 + (x1 - x0) * u;
          out.push(thing(x - 0.012, x + 0.012, zc - 0.012, zc + 0.012, top, top + 0.65, "pipe"));
          out.push(thing(x - 0.11, x + 0.11, zc - 0.1, zc + 0.1, top + 0.1, top + 0.5, "green"));
          out.push(thing(x + 0.06, x + 0.12, zc - 0.13, zc - 0.07, top + 0.22, top + 0.28, "flower"));
          out.push(thing(x - 0.12, x - 0.06, zc + 0.05, zc + 0.11, top + 0.32, top + 0.38, "flower"));
        }
      } else {
        out.push(thing(x0 + 0.15, x0 + 0.6, zc - 0.2, zc + 0.2, top, top + 0.08, "carton"));
        out.push(thing(x0 + 0.2, x0 + 0.55, zc - 0.15, zc + 0.15, top + 0.08, top + 0.14, "green"));
      }
    }
  });
  return out;
};

/** The washing: two posts (solid), the line, clothes hanging off it by the hash. */
const washing = (): Piece[] => {
  const w = WASHING;
  const out: Piece[] = [
    { ...piece(box(w.x - 0.04, w.x + 0.04, w.z0 - 0.04, w.z0 + 0.04, R - 0.05, R + w.line + 0.05), "pipe", true), inside: true },
    { ...piece(box(w.x - 0.04, w.x + 0.04, w.z1 - 0.04, w.z1 + 0.04, R - 0.05, R + w.line + 0.05), "pipe", true), inside: true },
    thing(w.x - 0.01, w.x + 0.01, w.z0, w.z1, R + w.line - 0.01, R + w.line + 0.01, "cable"),
  ];
  for (let z = w.z0 + 0.35; z < w.z1 - 0.4; z += 0.62) {
    const h = roofHash(z, w.x);
    if (h < 0.2) continue;
    // A shirt, a towel, socks: a hand to half a metre wide, hanging a hand to half a metre down.
    const width = 0.15 + 0.35 * roofHash(w.x, z);
    out.push(thing(w.x - 0.015, w.x + 0.015, z, z + width, R + w.line - 0.12 - 0.4 * h, R + w.line, "laundry"));
  }
  return out;
};

/** The camping chair by the crates, facing them, and what is round it. */
export const CHAIR = { x: 432.0, z: 43.4 } as const;
const chair = (): Piece[] => {
  const { x, z } = CHAIR;
  return [
    // Solid as its frame's box; the engine draws the seat, back and legs in it.
    { ...piece(box(x - 0.28, x + 0.28, z - 0.28, z + 0.28, R - 0.05, R + 0.85), "chair", true), inside: true },
    // Cans: two empty on their sides, one open on the armrest's level beside it, a bucket.
    thing(x - 0.55, x - 0.43, z + 0.35, z + 0.42, R, R + 0.07, "can"),
    thing(x - 0.2, x - 0.13, z + 0.5, z + 0.62, R, R + 0.07, "can"),
    thing(x + 0.35, x + 0.42, z - 0.1, z - 0.03, R, R + 0.12, "can"),
    thing(x + 0.4, x + 0.66, z + 0.3, z + 0.56, R, R + 0.3, "can"),
    // A radio with its light on, an ashtray on a crate's lid with a cigarette smoking in it (§5: somebody just got up).
    thing(x + 0.35, x + 0.65, z - 0.55, z - 0.37, R, R + 0.16, "machine"),
    thing(x + 0.6, x + 0.63, z - 0.52, z - 0.45, R + 0.09, R + 0.13, "display"),
    thing(x - 0.5, x - 0.36, z - 0.45, z - 0.31, R, R + 0.04, "can"),
    thing(x - 0.445, x - 0.425, z - 0.39, z - 0.37, R + 0.04, R + 0.62, "steam"),
    // A sack of soil and a watering can tipped over in its puddle by the crates.
    thing(431.25, 431.65, 46.3, 46.9, R, R + 0.22, "carton"),
    thing(431.25, 431.55, 47.15, 47.33, R, R + 0.16, "can"),
    thing(431.1, 431.9, 47.0, 47.7, R, R + 0.005, "water"),
  ];
};

/** On the picnic table: a cup still steaming, an open lunch box, a phone face up with its screen lit. */
const table = (): Piece[] => {
  const t = ROOF_TABLES[0]!;
  const y = R + 0.75;
  return [
    thing(t.x0 + 0.3, t.x0 + 0.38, t.z0 + 0.3, t.z0 + 0.38, y, y + 0.1, "cup"),
    thing(t.x0 + 0.31, t.x0 + 0.37, t.z0 + 0.31, t.z0 + 0.37, y + 0.1, y + 0.45, "steam"),
    thing(t.x0 + 0.2, t.x0 + 0.6, t.z0 + 0.6, t.z0 + 0.85, y, y + 0.06, "carton"),
    thing(t.x0 + 0.5, t.x0 + 0.58, t.z1 - 0.45, t.z1 - 0.3, y, y + 0.01, "display"),
    thing(t.x0 + 0.1, t.x0 + 0.4, t.z1 - 0.3, t.z1 - 0.1, R, R + 0.005, "paper"),
  ];
};

/** The roof's services, the residents' garden and the traces: their pieces. */
export const roofDressPieces = (): Piece[] => [...airHandler(), ...panels(), ...mast(), ...cables(), ...crates(), ...washing(), ...chair(), ...table()];

/** The game's models among the services: the street cabinet feeding the panels and the mast. */
export const ROOF_DRESS_PROPS: readonly StreetPropItem[] = [{ prop: "street-cabinet", x: 431.6, y: R, z: 37.4, yaw: Math.PI / 2, variant: 0 }];
