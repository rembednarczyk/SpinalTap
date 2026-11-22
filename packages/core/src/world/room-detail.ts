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
}

/** Shapes in the order the rooms came: a new one goes last, so the variants of those before stay. */
export const ROOM_DETAIL_SHAPES: readonly RoomDetailShape[] = [
  // Neon Koi (docs/pomieszczenia/neon-koi.md).
  { key: "rd-koi-counter" },
  { key: "rd-koi-shelf" },
  { key: "rd-koi-stool" },
  { key: "rd-koi-table" },
  { key: "rd-koi-chair" },
  { key: "rd-koi-jukebox" },
  { key: "rd-koi-aquarium" },
  { key: "rd-koi-counter-things" },
  // Doktor Mori's clinic (docs/pomieszczenia/clinic.md).
  { key: "rd-clinic-bench" },
  { key: "rd-clinic-reception" },
  { key: "rd-clinic-chair" },
  { key: "rd-clinic-lamp" },
  { key: "rd-clinic-cart" },
  { key: "rd-clinic-cabinet" },
  { key: "rd-clinic-counter-things" },
  { key: "rd-clinic-sharps" },
  // Tessen's pass office in W-3's tower (docs/pomieszczenia/tessen-office.md).
  { key: "rd-tessen-desk" },
  { key: "rd-tessen-cabinet" },
  { key: "rd-tessen-bench" },
  { key: "rd-tessen-board" },
  { key: "rd-tessen-lights" },
  // Trasa Podziemna under the Rynek (docs/pomieszczenia/trasa-podziemna.md).
  { key: "rd-trasa-arch-24" },
  { key: "rd-trasa-arch-21" },
  { key: "rd-trasa-stage" },
  { key: "rd-trasa-speaker" },
  { key: "rd-trasa-board" },
  { key: "rd-trasa-rope" },
  { key: "rd-trasa-bedding" },
  { key: "rd-trasa-lamp" },
  // The capsule room on Jezuicka (docs/pomieszczenia/capsule.md).
  { key: "rd-capsule-door" },
  { key: "rd-capsule-hooks" },
  { key: "rd-capsule-trash" },
  { key: "rd-capsule-sink" },
  { key: "rd-capsule-food" },
  { key: "rd-capsule-towel" },
  { key: "rd-capsule-charger" },
  { key: "rd-capsule-rules" },
  // The basement under W-3's hall and its culvert (docs/pomieszczenia/w3-basement.md).
  { key: "rd-w3b-pipes", fine: true },
  { key: "rd-w3b-pump" },
  { key: "rd-w3b-panel" },
  { key: "rd-w3b-bulb", fine: true },
  { key: "rd-w3b-handrail-a", fine: true },
  { key: "rd-w3b-handrail-b", fine: true },
  { key: "rd-w3b-brick-wide", fine: true },
  { key: "rd-w3b-brick-tall", fine: true },
  { key: "rd-w3b-grate", fine: true },
  { key: "rd-w3b-stash", fine: true },
  { key: "rd-w3b-water", fine: true },
  // W-3's assembly hall (docs/pomieszczenia/w3-hall.md).
  { key: "rd-w3h-pallet-crates" },
  { key: "rd-w3h-pallet-sacks" },
  { key: "rd-w3h-jack", fine: true },
  { key: "rd-w3h-barrels", fine: true },
  { key: "rd-w3h-leak", fine: true },
  { key: "rd-w3h-trays", fine: true },
  { key: "rd-w3h-break", fine: true },
  { key: "rd-w3h-exit", fine: true },
  { key: "rd-w3h-warning", fine: true },
  // The metro's platforms (docs/pomieszczenia/metro-*.md).
  { key: "rd-metro-vent" },
  { key: "rd-metro-timetable" },
  { key: "rd-metro-validator" },
  { key: "rd-metro-litter" },
  { key: "rd-metro-poster-a" },
  { key: "rd-metro-poster-b" },
  { key: "rd-metro-camera" },
  // The air-raid shelter under Alchemia's T2 (docs/pomieszczenia/alchemia-shelter.md).
  { key: "rd-shelter-door" },
  { key: "rd-shelter-masks" },
  { key: "rd-shelter-oil-lamp" },
  { key: "rd-shelter-list" },
  { key: "rd-shelter-conduit" },
  { key: "rd-shelter-shards" },
  { key: "rd-shelter-prints" },
  { key: "rd-shelter-hebi" },
  // Alchemia's car store P-2 (docs/pomieszczenia/alchemia-p2.md).
  { key: "rd-p2-tech" },
  { key: "rd-p2-cabinet" },
  { key: "rd-p2-pipes" },
  { key: "rd-p2-lamp" },
  { key: "rd-p2-oil" },
  // Alchemia's car park P-1 (docs/pomieszczenia/alchemia-parking.md).
  { key: "rd-p1-column" },
  { key: "rd-p1-charger" },
  { key: "rd-p1-ceiling" },
  { key: "rd-p1-barrier" },
  { key: "rd-p1-cabin-screen" },
  { key: "rd-p1-guard" },
  { key: "rd-p1-floor" },
  // Alchemia's food hall on P3 (docs/pomieszczenia/alchemia-foodhall.md).
  { key: "rd-fh-lantern" },
  { key: "rd-fh-lantern-small" },
  { key: "rd-fh-ramen" },
  { key: "rd-fh-donburi" },
  { key: "rd-fh-cup" },
  { key: "rd-fh-spilled" },
  { key: "rd-fh-stool" },
  { key: "rd-fh-pot" },
  { key: "rd-fh-bowls" },
  { key: "rd-fh-teacup" },
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
];

/** A shape's index by its key (throws on a key that is not in the table: a typo in a room's list). */
export const roomDetailShape = (key: string): number => {
  const i = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === key);
  if (i < 0) throw new Error(`room-detail: no shape ${key}`);
  return i;
};
