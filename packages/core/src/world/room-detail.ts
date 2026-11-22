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
}

/** Shapes in the order the rooms came: a new one goes last, so the variants of those before stay. */
export const ROOM_DETAIL_SHAPES: readonly RoomDetailShape[] = [
  // Neon Koi (docs/pomieszczenia/neon-koi.md).
  { key: "rd-koi-counter" },
  { key: "rd-koi-shelf", clutter: 8 },
  { key: "rd-koi-stool" },
  { key: "rd-koi-table", clutter: 2 },
  { key: "rd-koi-chair" },
  { key: "rd-koi-jukebox" },
  { key: "rd-koi-aquarium" },
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
  { key: "rd-tessen-lights" },
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
  { key: "rd-w3b-pump" },
  { key: "rd-w3b-panel" },
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
  { key: "rd-w3h-leak", fine: true, clutter: 3 },
  { key: "rd-w3h-trays", fine: true, services: true },
  { key: "rd-w3h-break", fine: true, clutter: 5 },
  { key: "rd-w3h-exit", fine: true, clutter: 0 },
  { key: "rd-w3h-warning", fine: true, clutter: 1 },
  // The metro's platforms (docs/pomieszczenia/metro-*.md).
  { key: "rd-metro-vent" },
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
  { key: "rd-p2-tech", clutter: 5 },
  { key: "rd-p2-cabinet" },
  { key: "rd-p2-pipes", services: true },
  { key: "rd-p2-lamp" },
  { key: "rd-p2-oil", clutter: 2 },
  // Alchemia's car park P-1 (docs/pomieszczenia/alchemia-parking.md).
  { key: "rd-p1-column" },
  { key: "rd-p1-charger" },
  { key: "rd-p1-ceiling", services: true },
  { key: "rd-p1-barrier" },
  { key: "rd-p1-cabin-screen" },
  { key: "rd-p1-guard", clutter: 4 },
  { key: "rd-p1-floor", clutter: 3 },
  // Alchemia's food hall on P3 (docs/pomieszczenia/alchemia-foodhall.md).
  { key: "rd-fh-lantern" },
  { key: "rd-fh-lantern-small" },
  { key: "rd-fh-ramen", clutter: 1 },
  { key: "rd-fh-donburi", clutter: 1 },
  { key: "rd-fh-cup", fine: true, clutter: 1 },
  { key: "rd-fh-spilled", fine: true, clutter: 1 },
  { key: "rd-fh-stool" },
  { key: "rd-fh-pot" },
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
  { key: "rd-c-cups", fine: true, clutter: 3 },
  { key: "rd-c-cartons", clutter: 0 },
  { key: "rd-c-papers", fine: true, clutter: 3 },
  { key: "rd-c-cable", fine: true, clutter: 1 },
  { key: "rd-c-bottles", fine: true, clutter: 3 },
  { key: "rd-c-laptop", fine: true, clutter: 1 },
  { key: "rd-c-extinguisher", clutter: 0 },
  { key: "rd-c-hydrant", clutter: 0 },
  { key: "rd-c-fusebox", services: true },
  { key: "rd-c-drain", fine: true, services: true },
  { key: "rd-c-puddle", fine: true, clutter: 0 },
];

/** A shape's index by its key (throws on a key that is not in the table: a typo in a room's list). */
export const roomDetailShape = (key: string): number => {
  const i = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === key);
  if (i < 0) throw new Error(`room-detail: no shape ${key}`);
  return i;
};
