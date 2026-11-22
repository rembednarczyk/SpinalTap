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
  { key: "rd-w3b-pipes" },
  { key: "rd-w3b-pump" },
  { key: "rd-w3b-panel" },
  { key: "rd-w3b-bulb" },
  { key: "rd-w3b-handrail-a" },
  { key: "rd-w3b-handrail-b" },
  { key: "rd-w3b-brick-wide" },
  { key: "rd-w3b-brick-tall" },
  { key: "rd-w3b-grate" },
  { key: "rd-w3b-stash" },
  { key: "rd-w3b-water" },
  // W-3's assembly hall (docs/pomieszczenia/w3-hall.md).
  { key: "rd-w3h-pallet-crates" },
  { key: "rd-w3h-pallet-sacks" },
  { key: "rd-w3h-jack" },
  { key: "rd-w3h-barrels" },
  { key: "rd-w3h-leak" },
  { key: "rd-w3h-trays" },
  { key: "rd-w3h-break" },
  { key: "rd-w3h-exit" },
  { key: "rd-w3h-warning" },
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
];

/** A shape's index by its key (throws on a key that is not in the table: a typo in a room's list). */
export const roomDetailShape = (key: string): number => {
  const i = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === key);
  if (i < 0) throw new Error(`room-detail: no shape ${key}`);
  return i;
};
