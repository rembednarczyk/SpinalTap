/**
 * The retaining walls of the Plac Katedralny's terrace along Królewska (T-350, the curator's audit
 * `docs/plany/archikatedra-otoczenie.md` §1, stage K5a of `docs/plany/archikatedra.md`): OSM tags them
 * `barrier=wall` with `height=3`, the height from the street with the parapet at its highest, and the
 * game stood 3 m on the ground at the wall's axis, halfway down the smeared step, so a grey wall 1.6-2.5 m
 * over the terrace and 3.3-4.1 m over the pavement. NMT: the terrace 1.0-2.8 m over the pavement, NMPT:
 * a parapet of 0.2-0.6 m over the terrace. Until the step itself is in the terrain (stage K5b,
 * breaklines), a retaining wall 1.4 m over its axis: its top some 0.4 m over the terrace (y −2.1); of
 * stone, as on the user's Street View (light stone walls with a coping).
 */
import type { TagCorrection } from "./corrections.ts";

const REASON = "murek oporowy tarasu Placu Katedralnego przy Królewskiej: parapet 0,2–0,6 m nad tarasem (NMPT) i uskok 1,0–2,8 m (NMT) zamiast muru 3 m od osi";

export const MURKI_CORRECTIONS: readonly TagCorrection[] = ["w590597335", "w232362979"].map((id) => ({
  id,
  tags: { barrier: "retaining_wall", height: "1.4", material: "stone" },
  reason: REASON,
  ref: "T-350",
}));
