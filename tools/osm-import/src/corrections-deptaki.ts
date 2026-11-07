/**
 * Widths of pedestrian streets and paths and a paved yard (ADR-0042, T-199), the tail of
 * `TAG_CORRECTIONS`: kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 */
import type { TagCorrection } from "./corrections.ts";

/**
 * A pedestrian street with no `width` in OSM is a band 8 m wide (`lineBands`), so a lane 4-6 m wide
 * laid its paving over the lawns along it, which drew under it (T-199). The widths are the paving's
 * on the orthophoto (PZGiK), read across the way every 6-15 m along it.
 */
export const DEPTAKI_CORRECTIONS: readonly TagCorrection[] = [
  {
    // Between the garden wall of the Carmelites (their lawn w232805974 behind it) and the retaining
    // wall south: 4.1-4.3 m of paving 20-40 m from the west end, 1.75 m north and 2.4 m south of the
    // axis, so a band round the axis takes 5 m to cover it; further east 2.7-3 m of paving with a
    // verge along the wall. The lawn starts 3.3 m north of the axis.
    id: "w232805946",
    tags: { width: "5" },
    reason: "Karmelicka: 4,1–4,3 m kostki między murami na ortofoto PZGiK (od −1,75 do +2,4 m od osi) wobec domyślnych 8 m deptaka, które kładły się na trawnik za murem",
    ref: "T-199",
  },
  {
    // Zamkowa's causeway from the viaduct w232362907 on to the castle's forecourt: 6.5-6.6 m with the
    // parapets between the lawns r949675 (0-20 m from the viaduct), 6.9 m where the trees are, 7.4 m
    // where it opens on to the forecourt. The viaduct's deck, 6.4-7.0 m on the photograph, keeps the
    // default 8 m: the niche of the steps down from it (T-147) is cut to that deck, and a narrower
    // one opened slots between the deck and the steps (`deck-slot`).
    id: "w154962966",
    tags: { width: "6.5" },
    reason: "grobla Zamkowej: 6,5–6,6 m z murkami między trawnikami Błoni na ortofoto PZGiK wobec domyślnych 8 m deptaka",
    ref: "T-199",
  },
  {
    // Plac Litewski's north promenade: 5.5-6.1 m of paving between the lawns and the beds on both
    // sides in its west half, 5.8-6.6 m between the railing and the stalls in its east half.
    id: "w1054556920",
    tags: { width: "6" },
    reason: "północna aleja Placu Litewskiego: 5,5–6,1 m kostki między trawnikami na ortofoto PZGiK wobec domyślnych 8 m deptaka",
    ref: "T-199",
  },
  {
    // The path along the west edge of the lawn w631252861: 1.4 m between the bed and the lawn.
    id: "w1269052752",
    tags: { width: "1.5" },
    reason: "ścieżka z kostki przy zachodnim brzegu trawnika w631252861 na Placu Litewskim: 1,4 m na ortofoto PZGiK wobec domyślnych 2,5 m",
    ref: "T-199",
  },
  {
    // The strip of setts along the east edge of the lawn w631252861, 0.6-0.8 m, the square's paving
    // with the benches east of it.
    id: "w1269052749",
    tags: { width: "1" },
    reason: "pas kostki przy wschodnim brzegu trawnika w631252861 na Placu Litewskim: 0,6–0,8 m na ortofoto PZGiK wobec domyślnych 2,5 m",
    ref: "T-199",
  },
  {
    // `landuse=grass` on the yard east of Szambelańska, which the orthophoto (PZGiK) shows paved with
    // slabs, cars and a stage on it, a few shrubs along the lane: paved. A pedestrian area wins over
    // the landuse in `areaSurface`, so the yard is a square. Szambelańska keeps the default 8 m: the
    // lane is 3.3-5.1 m between the walls mapped on both sides, but its axis lies up to 1 m off their
    // middle and it widens to 7.5-8.6 m by Brama Krakowska, so a 4 m band bared 85 m² more ground along
    // the façades and by the gate; this yard was its only lawn.
    id: "w470555118",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    reason: "podwórze przy Szambelańskiej wyłożone płytami, z autami i sceną na ortofoto PZGiK, w OSM landuse=grass",
    ref: "T-199",
  },
];
