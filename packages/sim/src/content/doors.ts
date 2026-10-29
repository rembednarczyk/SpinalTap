import { type DoorDef, type StaticProp, v } from "./builders";

/**
 * Automatic doors (ADR-0038): one or two leaves that slide sideways into the wall by their own
 * width. A sensor round the middle of the opening opens them for a character inside it and
 * closes them a moment after it empties. Pure data; the door system moves them.
 */

/** Sensor radius round the middle of the opening, metres. */
export const DOOR_SENSOR = 2;
/** Seconds the sensor must stay empty before the door closes. */
export const DOOR_CLOSE_DELAY = 1.5;
/** Seconds a leaf takes from closed to open. */
export const DOOR_MOVE_TIME = 0.4;

const LEAF_THICKNESS = 0.1;

/** The leaves of a door (and the panel of a coded one), as kinematic props. */
export const doorParts = (d: DoorDef): StaticProp[] => {
  const t = d.thickness ?? LEAF_THICKNESS;
  const leafWidth = d.width / d.leaves;
  const material = d.material ?? "metal";
  const leaves: StaticProp[] = [];
  for (let i = 0; i < d.leaves; i++) {
    // Two leaves part from the middle; one slides the way it is told.
    const side = d.leaves === 2 ? (i === 0 ? -1 : 1) : (d.dir ?? 1);
    const offset = d.leaves === 2 ? side * (leafWidth / 2) : 0;
    const center = d.along === "x" ? v(d.at.x + offset, d.at.y + d.height / 2, d.at.z) : v(d.at.x, d.at.y + d.height / 2, d.at.z + offset);
    const size = d.along === "x" ? v(leafWidth, d.height, t) : v(t, d.height, leafWidth);
    const slide = d.along === "x" ? { x: side * leafWidth, z: 0 } : { x: 0, z: side * leafWidth };
    leaves.push({ center, view: { kind: "block", size, material }, solid: true, mechanism: { kind: "door", door: d, leaf: i, slide } });
  }
  if (d.panel) {
    leaves.push({
      center: d.panel,
      view: { kind: "block", size: v(0.12, 0.3, 0.2), material: "glass" },
      solid: false,
      mechanism: { kind: "door-panel", door: d.key },
    });
  }
  return leaves;
};
