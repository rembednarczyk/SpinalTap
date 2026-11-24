import { type StreetPropItem, roomDetailShape } from "@seki/core";
import type { SceneLampGroup } from "./scene-lamp";
import { turnLocal } from "./lublin/furniture";
import { groundY } from "./lublin/terrain";

/*
 * Plac po Farze after its card (`docs/lokacje/plac-po-farze.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). The coin-op viewing telescope on the square's east side looking over the
 * escarpment to the Castle, its AR screen lit (Blender, `tools/blender/rooms/plac_po_farze.py`), and two benches by it
 * (the card: one bench on the terrace today): the game's furniture with their solids.
 */

/** The telescope on the square's open east side (4.6 m off the nearest wall), its view to the east. */
export const FARA_TELESCOPE = { x: 690, z: 55, yaw: Math.PI / 2 } as const;

const at = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number): StreetPropItem => ({ prop, x, y: groundY(x, z), z, yaw, variant });

/** The benches either side of the telescope, facing the view. */
export const FARA_BENCHES: readonly StreetPropItem[] = [at("bench", 688.6, 52.2, Math.PI / 2, 1), at("bench", 688.6, 57.8, Math.PI / 2, 1)];

/**
 * The bare bulb on its pole in a concrete-filled bucket (`rd-targ-bulb-pole`, `dzielnica_targ.py`) at the head of the
 * steps down to Zaułek Panasa (their top flight from (696; 49) east): the way down lit (§13, the card's debt), off the
 * flight's south side on the terrace, its arm over the first tread. No wall within 4 m there, so a pole.
 */
export const FARA_STEPS_BULB = { x: 694.6, z: 47.4, yaw: Math.PI / 2 } as const;

/**
 * The hologram of St Michael's parish church over its foundations (the card's debt: the square's accent seen from Grodzka,
 * §13; ADR-0062: the 2077 layer on a monument is light): lines of light on the church's plan from the foundations (the
 * curator's review of 24.11), its heights approximate (`plac_po_farze.py`). Its origin on the nave's axis, the model's
 * +z along the world's +x (the church faces east).
 */
export const FARA_HOLO = { x: 676.0, z: 42.3, yaw: Math.PI / 2 } as const;

export const PO_FARZE_DETAIL: readonly StreetPropItem[] = [
  { ...at("room-detail", FARA_TELESCOPE.x, FARA_TELESCOPE.z, FARA_TELESCOPE.yaw, 0), variant: roomDetailShape("rd-fara-telescope") },
  ...FARA_BENCHES,
  { ...at("room-detail", FARA_STEPS_BULB.x, FARA_STEPS_BULB.z, FARA_STEPS_BULB.yaw, 0), variant: roomDetailShape("rd-targ-bulb-pole") },
  { ...at("room-detail", FARA_HOLO.x, FARA_HOLO.z, FARA_HOLO.yaw, 0), variant: roomDetailShape("rd-fara-holo") },
];

/** A light in its fitting's frame, from the fitting's foot `f` turned by its yaw. */
const inFitting = (f: { readonly x: number; readonly z: number; readonly yaw: number }, y: number, z: number) => {
  const d = turnLocal(f.yaw, 0, z);
  return { x: f.x + d.x, y: groundY(f.x, f.z) + y, z: f.z + d.z };
};

/**
 * The square's lights of the game (the night measure of 24.11: 87% base, 0.2% accent): the telescope's AR screen as
 * the accent (§13, its cyan panel on the hood's back, `plac_po_farze.py`: y 0.98-1.13, z -0.38) and the bulb at the
 * head of the steps as the way's light (`rd-targ-bulb-pole`: the bulb at y 2.52, 0.5 m out on the arm). On within
 * 60 m of the square (`SceneLamps`).
 */
export const PO_FARZE_LAMPS: SceneLampGroup = {
  id: "po-farze",
  centre: { x: 680, z: 50 },
  near: 60,
  lamps: [
    { key: "po-farze-screen", at: inFitting(FARA_TELESCOPE, 1.055, -0.45), color: "#2ee6ff", range: 2.5, intensity: 0.45 },
    { key: "po-farze-steps", at: inFitting(FARA_STEPS_BULB, 2.52, 0.5), color: "#ffe2b8", range: 6, intensity: 0.6 },
  ],
};
