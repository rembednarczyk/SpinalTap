/**
 * The room detail of ADR-0098 (`room-detail`): one model of `room-detail-props.glb` per shape, the shape
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
];

/** A shape's index by its key (throws on a key that is not in the table: a typo in a room's list). */
export const roomDetailShape = (key: string): number => {
  const i = ROOM_DETAIL_SHAPES.findIndex((s) => s.key === key);
  if (i < 0) throw new Error(`room-detail: no shape ${key}`);
  return i;
};
