/**
 * The room detail of ADR-0098 (`room-detail`): one model of the `room-detail*-props.glb` files (one a district) per shape, the shape
 * in a piece's `variant`. The models are built by Blender from the scripts in `tools/blender/` after the
 * rooms' cards (`docs/pomieszczenia/`); the simulation keeps its own solids for them (the blocks of the
 * room, drawn no more, `scenery`), so a shape here has no solid of its own. The renderer bakes the model
 * into the chunk's furniture mesh: vertices, not draw calls.
 */
export interface RoomDetailShape {
  /** The model's key in `room-detail-props.glb`. */
  readonly key: string;
  /**
   * Small detail (§11's third layer, as the odds and ends of ADR-0096): the phones go without it, as without the fine
   * decals and most clutter (`docs/zasady-lokacji.md` §9: simplified only on the phone and from afar). The furniture a
   * walker meets is never fine.
   */
  readonly fine?: true;
  /**
   * The phone's model of it (`docs/zasady-lokacji.md` §9: simplified only on the phone and from afar): the same thing's
   * outline in a few plain boxes, where there are so many (the goods on a gallery's shelves) that the full one costs
   * the phone too many triangles. Its key in the same file; no shape of its own.
   */
  readonly lod?: string;
  /**
   * The hand-sized things the model holds (`docs/zasady-lokacji.md` §14's micro layer): a cup, a phone, a can, a
   * rag. One model that is a clutter cluster (the night shift's thermos, sandwich and hard hat) counts as that many
   * things in one place in the rooms' measures (`tools/rooms`); 0 for a model with none (a drum, a lamp, a sign).
   * Unset: the measures go by `fine`.
   */
  readonly clutter?: number;
  /** The room's services on show (pipes, cable trays, handrails, patched brick): §12's architecture, not its dressing. */
  readonly services?: true;
  /**
   * The steady sound it makes (`docs/zasady-lokacji.md` §17, sound from its source; ADR-0099 stage 6): every placing of it
   * is an emitter of the rooms' soundscape, heard whole in its room and dull through the walls.
   */
  readonly sound?: RoomSound;
}

/**
 * The rooms' steady sounds: a fan's hiss, mains hum, a water pump, a drip, a pot simmering, strip lights' buzz, and a
 * square's fountain splashing (its jets are the map's `fountain-jets`, not a room-detail model).
 */
export type RoomSound = "vent" | "hum" | "pump" | "drip" | "simmer" | "tubes" | "fountain";

/** Shapes in the order the rooms came: a new one goes last, so the variants of those before stay. */
export const ROOM_DETAIL_SHAPES: readonly RoomDetailShape[] = [
  // Neon Koi (docs/pomieszczenia/neon-koi.md).
  { key: "rd-koi-counter" },
  { key: "rd-koi-shelf", clutter: 8 },
  { key: "rd-koi-stool" },
  { key: "rd-koi-table", clutter: 2 },
  { key: "rd-koi-chair" },
  { key: "rd-koi-jukebox" },
  { key: "rd-koi-aquarium", sound: "pump" },
  { key: "rd-koi-counter-things", clutter: 5 },
  // Doktor Mori's clinic (docs/pomieszczenia/clinic.md).
  { key: "rd-clinic-bench" },
  { key: "rd-clinic-reception" },
  { key: "rd-clinic-chair" },
  { key: "rd-clinic-lamp" },
  { key: "rd-clinic-cart", clutter: 4 },
  { key: "rd-clinic-cabinet", clutter: 6 },
  { key: "rd-clinic-counter-things", clutter: 4 },
  { key: "rd-clinic-sharps" },
  // Tessen's pass office in W-3's tower (docs/pomieszczenia/tessen-office.md).
  { key: "rd-tessen-desk", clutter: 5 },
  { key: "rd-tessen-cabinet", clutter: 1 },
  { key: "rd-tessen-bench", clutter: 2 },
  { key: "rd-tessen-board", clutter: 3 },
  { key: "rd-tessen-lights", sound: "tubes" },
  // Trasa Podziemna under the Rynek (docs/pomieszczenia/trasa-podziemna.md).
  { key: "rd-trasa-arch-24" },
  { key: "rd-trasa-arch-21" },
  { key: "rd-trasa-stage", clutter: 3 },
  { key: "rd-trasa-speaker" },
  { key: "rd-trasa-board", clutter: 3 },
  { key: "rd-trasa-rope" },
  { key: "rd-trasa-bedding", clutter: 5 },
  { key: "rd-trasa-lamp" },
  // The capsule room on Jezuicka (docs/pomieszczenia/capsule.md).
  { key: "rd-capsule-door" },
  { key: "rd-capsule-hooks", clutter: 2 },
  { key: "rd-capsule-trash", clutter: 3 },
  { key: "rd-capsule-sink", clutter: 4 },
  { key: "rd-capsule-food", clutter: 6 },
  { key: "rd-capsule-towel", clutter: 1 },
  { key: "rd-capsule-charger", clutter: 3 },
  { key: "rd-capsule-rules", clutter: 1 },
  // The basement under W-3's hall and its culvert (docs/pomieszczenia/w3-basement.md).
  { key: "rd-w3b-pipes", fine: true, services: true },
  { key: "rd-w3b-pump", sound: "pump" },
  { key: "rd-w3b-panel", sound: "hum" },
  { key: "rd-w3b-bulb", fine: true, clutter: 0 },
  { key: "rd-w3b-handrail-a", fine: true, services: true },
  { key: "rd-w3b-handrail-b", fine: true, services: true },
  { key: "rd-w3b-brick-wide", fine: true, services: true },
  { key: "rd-w3b-brick-tall", fine: true, services: true },
  { key: "rd-w3b-grate", fine: true, clutter: 0 },
  { key: "rd-w3b-stash", fine: true, clutter: 3 },
  { key: "rd-w3b-water", fine: true, clutter: 3 },
  // W-3's assembly hall (docs/pomieszczenia/w3-hall.md).
  { key: "rd-w3h-pallet-crates" },
  { key: "rd-w3h-pallet-sacks" },
  { key: "rd-w3h-jack", fine: true, clutter: 0 },
  { key: "rd-w3h-barrels", fine: true, clutter: 0 },
  { key: "rd-w3h-leak", fine: true, clutter: 3, sound: "drip" },
  { key: "rd-w3h-trays", fine: true, services: true },
  { key: "rd-w3h-break", fine: true, clutter: 5 },
  { key: "rd-w3h-exit", fine: true, clutter: 0 },
  { key: "rd-w3h-warning", fine: true, clutter: 1 },
  // The metro's platforms (docs/pomieszczenia/metro-*.md).
  { key: "rd-metro-vent", sound: "vent" },
  { key: "rd-metro-timetable" },
  { key: "rd-metro-validator" },
  { key: "rd-metro-litter", fine: true, clutter: 3 },
  { key: "rd-metro-poster-a", clutter: 1 },
  { key: "rd-metro-poster-b", clutter: 1 },
  { key: "rd-metro-camera" },
  // The air-raid shelter under Alchemia's T2 (docs/pomieszczenia/alchemia-shelter.md).
  { key: "rd-shelter-door" },
  { key: "rd-shelter-masks", clutter: 5 },
  { key: "rd-shelter-oil-lamp" },
  { key: "rd-shelter-list", clutter: 1 },
  { key: "rd-shelter-conduit", services: true },
  { key: "rd-shelter-shards", clutter: 3 },
  { key: "rd-shelter-prints", clutter: 1 },
  { key: "rd-shelter-hebi", clutter: 4 },
  // Alchemia's car store P-2 (docs/pomieszczenia/alchemia-p2.md).
  { key: "rd-p2-tech", clutter: 5, sound: "hum" },
  { key: "rd-p2-cabinet" },
  { key: "rd-p2-pipes", services: true },
  { key: "rd-p2-lamp" },
  { key: "rd-p2-oil", clutter: 2 },
  // Alchemia's car park P-1 (docs/pomieszczenia/alchemia-parking.md).
  { key: "rd-p1-column" },
  { key: "rd-p1-charger", sound: "hum" },
  { key: "rd-p1-ceiling", services: true },
  { key: "rd-p1-barrier" },
  { key: "rd-p1-cabin-screen" },
  { key: "rd-p1-guard", clutter: 4 },
  { key: "rd-p1-floor", clutter: 3 },
  // Alchemia's food hall on P3 (docs/pomieszczenia/alchemia-foodhall.md).
  { key: "rd-fh-lantern" },
  { key: "rd-fh-lantern-small" },
  { key: "rd-fh-ramen", clutter: 1, sound: "simmer" },
  { key: "rd-fh-donburi", clutter: 1 },
  { key: "rd-fh-cup", fine: true, clutter: 1 },
  { key: "rd-fh-spilled", fine: true, clutter: 1 },
  { key: "rd-fh-stool" },
  { key: "rd-fh-pot", sound: "simmer" },
  { key: "rd-fh-bowls", clutter: 1 },
  { key: "rd-fh-teacup", clutter: 1 },
  { key: "rd-fh-gas" },
  // Alchemia's gallery (docs/pomieszczenia/alchemia-gallery.md): half a metre of a shelf's goods by trade, its mirror, the phone's in boxes.
  { key: "rd-gl-pharmacy", lod: "rd-gl-pharmacy-lod" },
  { key: "rd-gl-electronics", lod: "rd-gl-electronics-lod" },
  { key: "rd-gl-food", lod: "rd-gl-food-lod" },
  { key: "rd-gl-pawn", lod: "rd-gl-pawn-lod" },
  { key: "rd-gl-repair", lod: "rd-gl-repair-lod" },
  { key: "rd-gl-implants", lod: "rd-gl-implants-lod" },
  { key: "rd-gl-arms", lod: "rd-gl-arms-lod" },
  { key: "rd-gl-tattoo", lod: "rd-gl-tattoo-lod" },
  { key: "rd-gl-vr", lod: "rd-gl-vr-lod" },
  { key: "rd-gl-florist", lod: "rd-gl-florist-lod" },
  { key: "rd-gl-stock", lod: "rd-gl-stock-lod" },
  { key: "rd-gl-pharmacy-b", lod: "rd-gl-pharmacy-lod" },
  { key: "rd-gl-electronics-b", lod: "rd-gl-electronics-lod" },
  { key: "rd-gl-food-b", lod: "rd-gl-food-lod" },
  { key: "rd-gl-pawn-b", lod: "rd-gl-pawn-lod" },
  { key: "rd-gl-repair-b", lod: "rd-gl-repair-lod" },
  { key: "rd-gl-implants-b", lod: "rd-gl-implants-lod" },
  { key: "rd-gl-arms-b", lod: "rd-gl-arms-lod" },
  { key: "rd-gl-tattoo-b", lod: "rd-gl-tattoo-lod" },
  { key: "rd-gl-vr-b", lod: "rd-gl-vr-lod" },
  { key: "rd-gl-florist-b", lod: "rd-gl-florist-lod" },
  { key: "rd-gl-stock-b", lod: "rd-gl-stock-lod" },
  // The gallery's glass cases by trade, its clothes rails, its windows' mannequins (each with the phone's).
  { key: "rd-gl-case-implants", lod: "rd-gl-case-implants-lod" },
  { key: "rd-gl-case-electronics", lod: "rd-gl-case-electronics-lod" },
  { key: "rd-gl-case-pharmacy", lod: "rd-gl-case-pharmacy-lod" },
  { key: "rd-gl-case-arms", lod: "rd-gl-case-arms-lod" },
  { key: "rd-gl-case-repair", lod: "rd-gl-case-repair-lod" },
  { key: "rd-gl-case-pawn", lod: "rd-gl-case-pawn-lod" },
  { key: "rd-gl-case-crypto", lod: "rd-gl-case-crypto-lod" },
  { key: "rd-gl-garments", lod: "rd-gl-garments-lod" },
  { key: "rd-gl-mannequin", lod: "rd-gl-mannequin-lod" },
  // ADR-0099 batch 1 (docs/pomieszczenia/katalog.md, families 1-3): the shared detail the dressing generator stands by its kits.
  // All of it fine: none on the phones, where a room's detail weighs on its whole 256 m block (Tessen's office in W-3's, `npr-perf`).
  { key: "rd-c-cups", fine: true, clutter: 3 },
  { key: "rd-c-cartons", fine: true, clutter: 0 },
  { key: "rd-c-papers", fine: true, clutter: 3 },
  { key: "rd-c-cable", fine: true, clutter: 1 },
  { key: "rd-c-bottles", fine: true, clutter: 3 },
  { key: "rd-c-laptop", fine: true, clutter: 1 },
  { key: "rd-c-extinguisher", fine: true, clutter: 0 },
  { key: "rd-c-hydrant", fine: true, clutter: 0 },
  { key: "rd-c-fusebox", fine: true, services: true, sound: "hum" },
  { key: "rd-c-drain", fine: true, services: true },
  { key: "rd-c-puddle", fine: true, clutter: 0 },
  // The food hall's clutter clusters (§14, 22.11): the tables' condiments and leftovers, the kitchens' tills and prep.
  { key: "rd-fh-condiments", clutter: 4 },
  { key: "rd-fh-leftovers", clutter: 3 },
  { key: "rd-fh-till", clutter: 4 },
  { key: "rd-fh-prep", clutter: 4 },
  // W-3's assembly hall (§14, 22.11): what the welder left on each station by the belts.
  { key: "rd-w3h-station", fine: true, clutter: 5 },
  // Alchemia's tunnel from P-2 to T2 (§14, 22.11): the butts by the store's end, the debris at the shelter's gate, the litter at the portal.
  { key: "rd-p2t-butts", fine: true, clutter: 4 },
  { key: "rd-p2t-gate", fine: true, clutter: 3 },
  { key: "rd-p2t-litter", fine: true, clutter: 4 },
  // ADR-0099 batch 2 (docs/pomieszczenia/katalog.md, family 4): the kinds of rooms' own furniture, fine as batch 1 (a
  // room's detail weighs on its whole 256 m block on the phones): the bar's washing-up, the clinic's basin and curtain,
  // the factory's lockers and control cabinet, the office's chair, shredder and binders.
  { key: "rd-k-bar-sink", fine: true, clutter: 0 },
  { key: "rd-k-washbasin", fine: true, clutter: 0 },
  { key: "rd-k-curtain", fine: true, clutter: 0 },
  { key: "rd-k-lockers", fine: true, clutter: 0 },
  { key: "rd-k-control-cabinet", fine: true, clutter: 0, sound: "hum" },
  { key: "rd-k-office-chair", fine: true, clutter: 0 },
  { key: "rd-k-shredder", fine: true, clutter: 0 },
  { key: "rd-k-binders", fine: true, clutter: 6 },
  // MYJNIA 24H and the yard behind it (docs/lokacje/myjnia-podworko.md, ADR-0102 point 5): the gantry and its dryer's hiss,
  // the machine room's wall with its pump, the chemistry by the bay, the bay's wet floor, the payment post, the canopy's
  // tubes and what the courier left round his feet.
  { key: "rd-cw-gantry", clutter: 0, sound: "vent" },
  { key: "rd-cw-machine", services: true, sound: "pump" },
  { key: "rd-cw-chem", clutter: 4 },
  { key: "rd-cw-bay", fine: true, clutter: 0 },
  { key: "rd-cw-pay", clutter: 0 },
  { key: "rd-cw-tubes", clutter: 0 },
  { key: "rd-cw-courier", fine: true, clutter: 6 },
  // The yard behind Neon Koi (docs/lokacje/koi-podworko.md, ADR-0102 point 5): the fittings of its lamps, the kitchen's
  // extract and the downpipe on the bar's back wall, the cook's smoke by the door, the empties, the scooter, the bottle
  // bank, the camera over the bins and the Hebi's mark. The lamps, the extract and the big things are on the phones too.
  { key: "rd-kb-canopy" },
  { key: "rd-kb-lantern" },
  { key: "rd-kb-batten" },
  { key: "rd-kb-extract", services: true, sound: "vent" },
  { key: "rd-kb-downpipe", services: true, sound: "drip" },
  { key: "rd-kb-smoke", fine: true, clutter: 5 },
  { key: "rd-kb-crates", clutter: 0 },
  { key: "rd-kb-scooter", clutter: 0 },
  { key: "rd-kb-glass-bin", clutter: 1 },
  { key: "rd-kb-camera", fine: true, clutter: 0 },
  { key: "rd-kb-tag", fine: true, clutter: 3 },
  // Plac Litewski's scene (docs/lokacje/plac-litewski.md, ADR-0102): the wreck on its roof, the bent pastoral and the
  // drone that hit it, what the night left on the paving, the van crew's litter and tarp, Shiro's poems.
  { key: "rd-lit-wreck" },
  { key: "rd-lit-bent-lamp" },
  { key: "rd-lit-drone", clutter: 3 },
  { key: "rd-lit-glass", fine: true, clutter: 5 },
  { key: "rd-lit-spill", fine: true, clutter: 0, sound: "drip" },
  { key: "rd-lit-skid", fine: true, clutter: 0 },
  { key: "rd-lit-tape", clutter: 1 },
  { key: "rd-lit-candles", fine: true, clutter: 8 },
  { key: "rd-lit-van-camp", fine: true, clutter: 9 },
  { key: "rd-lit-tarp", clutter: 1 },
  { key: "rd-lit-poems", fine: true, clutter: 6 },
  // W-3's outside (docs/lokacje/w3-pas-publiczny.md, w3-wieza.md, w3-rurociag-basen.md, ADR-0102): Genzō's brazier and
  // things by KAIUN, the smokers' corner by the pass office, the fitters' things on the pipe landing, the ladder's board.
  { key: "rd-w3-barrel", clutter: 0 },
  { key: "rd-w3-genzo", clutter: 6 },
  { key: "rd-w3-tower-door", fine: true, clutter: 9 },
  { key: "rd-w3-landing", fine: true, clutter: 7 },
  { key: "rd-w3-ladder-board", clutter: 0 },
  { key: "rd-w3-locker14", clutter: 3 },
];

/** A shape's index by its key (throws on a key that is not in the table: a typo in a room's list). */
export const roomDetailShape = (key: string): number => {
  const i = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === key);
  if (i < 0) throw new Error(`room-detail: no shape ${key}`);
  return i;
};
