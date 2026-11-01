import { type DoorLayout, type DoorModel, doorLayout } from "@seki/core";
import { MeshSink } from "../mesh-sink";
import { block, glow, paint } from "./prop-kit";

/**
 * The doors on the facades (ADR-0058 stage 9), procedural, in a door's frame: its back on the
 * wall at z = 0, its front +z, its foot on the paving at y = 0, `width` x `height`. What phones
 * draw (`low`) and every quality before the props files load; the models of `door-props.glb`
 * take the leaf's place on the others (`door-models.ts`), in the same frame and surround.
 *
 * Every door has the same surround: two jambs and a lintel `FRAME` deep, so its back covers the
 * plinth the facade draws 6 cm out from the wall up to 0.55 m (`facade-plan.ts`), and a sill.
 * Over a leaf lower than the door, a fanlight fills the rest (a tall door that took a window's
 * place, a shop's door under the top of its shop window).
 */

/** Depth of the surround out from the wall, the jambs' and lintel's width, where the leaf's face is (m). */
export const DOOR_FRAME = { depth: 0.2, side: 0.08, lintel: 0.1, leafAt: 0.08, leafDepth: 0.08 } as const;
/** The tallest a leaf is drawn; a taller door gets a transom and a fanlight over it (m). */
export const LEAF_TOP = 2.3;

const FRAME_COLOR = paint("#2a2e36");
const STEEL = paint("#4a515c");
const DARK = paint("#1b1d22");
const WOOD = paint("#5b3a2c");
const GLASS = glow("#1d3346");
const FANLIGHT = glow("#3b9ea6");

/** The leaf's height under the fanlight, for a door `height` tall (a roller shutter fills it all). */
export const leafHeight = (d: DoorLayout): number => (d.model === "shutter" ? d.height - DOOR_FRAME.lintel : Math.min(d.height - DOOR_FRAME.lintel, LEAF_TOP));

/** The surround: jambs, lintel, the sill, and the fanlight with its transom over a lower leaf. */
export const doorSurround = (sink: MeshSink, d: DoorLayout): void => {
  const { depth, side, lintel } = DOOR_FRAME;
  const z = depth / 2;
  for (const x of [-(d.width - side) / 2, (d.width - side) / 2]) block(sink, x, 0, z, side, d.height, depth, FRAME_COLOR);
  block(sink, 0, d.height - lintel, z, d.width, lintel, depth, FRAME_COLOR);
  block(sink, 0, 0, z, d.width, 0.03, depth, DARK);
  const leaf = leafHeight(d);
  const gap = d.height - lintel - leaf;
  if (gap > 0.04) {
    block(sink, 0, leaf, z, d.width - 2 * side, 0.06, depth * 0.8, FRAME_COLOR);
    block(sink, 0, leaf + 0.06, DOOR_FRAME.leafAt, d.width - 2 * side, Math.max(gap - 0.06, 0.01), 0.02, FANLIGHT);
  }
};

const leaves: Readonly<Record<DoorModel, (sink: MeshSink, w: number, h: number, z: number) => void>> = {
  steel: (sink, w, h, z) => {
    block(sink, 0, 0, z, w, h, DOOR_FRAME.leafDepth, STEEL);
    block(sink, 0, 1.0, z + 0.05, w * 0.8, 0.05, 0.03, DARK);
  },
  "steel-double": (sink, w, h, z) => {
    for (const s of [-1, 1]) block(sink, (s * w) / 4, 0, z, w / 2 - 0.01, h, DOOR_FRAME.leafDepth, STEEL);
    block(sink, 0, 1.0, z + 0.05, w * 0.8, 0.05, 0.03, DARK);
  },
  shop: (sink, w, h, z) => {
    for (const s of [-1, 1]) block(sink, (s * (w - 0.06)) / 2, 0, z, 0.06, h, DOOR_FRAME.leafDepth, DARK);
    block(sink, 0, 0, z, w, 0.25, DOOR_FRAME.leafDepth, DARK);
    block(sink, 0, 0.25, z, w - 0.12, h - 0.25, 0.02, GLASS);
  },
  tall: (sink, w, h, z) => {
    for (const s of [-1, 1]) block(sink, (s * w) / 4, 0, z, w / 2 - 0.01, h, DOOR_FRAME.leafDepth, WOOD);
    for (const s of [-1, 1]) block(sink, (s * w) / 4, h * 0.55, z + 0.045, w / 2 - 0.2, h * 0.35, 0.02, GLASS);
  },
  code: (sink, w, h, z) => {
    block(sink, 0, 0, z, w, h, DOOR_FRAME.leafDepth, DARK);
    block(sink, w / 2 - 0.16, 1.2, z + 0.05, 0.12, 0.2, 0.03, glow("#00e5ff"));
  },
  shutter: (sink, w, h, z) => {
    block(sink, 0, 0, z, w, h, 0.04, STEEL);
    for (let y = 0.3; y < h - 0.1; y += 0.3) block(sink, 0, y, z + 0.02, w, 0.03, 0.02, DARK);
    block(sink, 0, h - 0.3, z + 0.06, w, 0.3, 0.12, FRAME_COLOR);
  },
};

/** A leaf between the jambs: `width` the door's, drawn at the face the models' leaves stand at. */
export const doorLeaf = (sink: MeshSink, d: DoorLayout): void => leaves[d.model](sink, d.width - 2 * DOOR_FRAME.side, leafHeight(d), DOOR_FRAME.leafAt);

const cache = new Map<number, MeshSink>();

/** The procedural door of a variant, built once per variant. */
export const proceduralDoor = (variant: number): MeshSink => {
  let m = cache.get(variant);
  if (!m) {
    const d = doorLayout(variant);
    m = new MeshSink();
    doorSurround(m, d);
    doorLeaf(m, d);
    cache.set(variant, m);
  }
  return m;
};

/** For the gallery's row: a 1.2 x 2.3 m door of each model. */
export const doorOfShape = (shape: number): MeshSink => proceduralDoor(shape + 8 * (8 + 64 * 15));
