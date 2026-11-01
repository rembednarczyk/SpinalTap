import type { BlockSkin, BlockStyle, EnemyTypeId, FactionId, BlockFront, Vec3, ViewDescriptor } from "@seki/core";
import type { DoorLock, HideKind, Interactable, LadderDef } from "../world/components";
import type { PrismDef } from "../world/prism";

/** Shared vocabulary of the content tables. Coordinates: Y up, +Z north, yaw 0 faces +Z. */
export interface StaticProp {
  readonly center: Vec3;
  readonly view: ViewDescriptor;
  readonly solid: boolean;
  /**
   * The solid's shape as convex prisms (ADR-0043), corners relative to `center` on the XZ plane
   * and heights relative to `center.y`. Without it a solid `block` is its box, and a solid
   * `building` with a convex outline is one prism from y = center.y to the building's height.
   */
  readonly prisms?: readonly PrismDef[];
  /** Moving part of a lift (ADR-0020); the prop is then kinematic. */
  readonly mechanism?: Mechanism;
  /**
   * Part of an interior (ADR-0038): its shell, ceiling and furniture. The minimap draws the solid
   * parts as the building they are cut from and leaves the rest out.
   */
  readonly interior?: true;
  /**
   * Drawn by the map's scenery (ADR-0045), not by the entity: a building from the map is a solid
   * of the simulation, while the renderer gets its view once from `WORLD_SCENERY`.
   */
  readonly scenery?: true;
  /** Street furniture (ADR-0050): the TPP camera's rays pass it. */
  readonly seeThrough?: true;
  /** A hiding place for one body (ADR-0065): a container, a dumpster, a locker. */
  readonly hide?: HideKind;
}

/** Parts of a lift: the platform (a solid), the gates at upper levels and the call buttons. */
export type Mechanism =
  | { readonly kind: "platform"; readonly key: string; readonly levels: readonly [number, ...number[]]; readonly speed: number }
  | { readonly kind: "gate"; readonly elevator: string; readonly level: number; readonly travel: number }
  | { readonly kind: "button"; readonly elevator: string; readonly level: number }
  /** A fire escape ladder (ADR-0021) and the grab points at its ends. */
  | { readonly kind: "ladder"; readonly ladder: LadderDef }
  | { readonly kind: "ladder-end"; readonly ladder: string; readonly end: "bottom" | "top" }
  /** A leaf of an automatic door (ADR-0038): it slides by `slide` when open; the panel of a coded one. */
  | { readonly kind: "door"; readonly door: DoorDef; readonly leaf: number; readonly slide: { readonly x: number; readonly z: number } }
  | { readonly kind: "door-panel"; readonly door: string };

export interface ActorSpawn {
  readonly key: string;
  readonly position: Vec3;
  readonly yaw: number;
}

export interface GangerSpawn extends ActorSpawn {
  readonly tag: string | null;
}

/** A keyed character placed by content. Its state survives unloading and saves. */
/**
 * When a keyed actor is in the world (ADR-0023): every flag of `all` is set and none of `none`.
 * Without it the actor is always there. Streaming adds and removes actors as the flags change.
 */
export interface Presence {
  readonly all?: readonly string[];
  readonly none?: readonly string[];
}

export const isPresent = (presence: Presence | undefined, flags: readonly string[]): boolean =>
  !presence || ((presence.all ?? []).every((f) => flags.includes(f)) && !(presence.none ?? []).some((f) => flags.includes(f)));

export type ActorDef =
  | {
      readonly kind: "npc";
      readonly when?: Presence;
      readonly spawn: ActorSpawn;
      readonly preset: "fixer" | "civilian" | "ripperdoc";
      readonly faction: FactionId;
      readonly interactable?: Interactable;
      /** Bystander AI: keeps to its spot, flees a player the street fears. */
      readonly bystander?: true;
      /** Gives the NPC health, so it can be hurt and killed. NPCs without it cannot be. */
      readonly maxHp?: number;
      /** Stays under a roof (ADR-0041): no umbrella in hand. */
      readonly indoor?: true;
    }
  | {
      readonly kind: "ganger";
      readonly spawn: GangerSpawn;
      readonly when?: Presence;
      /** Enemy type and its health; without it a Hebi ganger with the default health. */
      readonly enemy?: EnemyTypeId;
      /** A street patrol (ADR-0048): watches a neutral player instead of attacking her. */
      readonly patrol?: true;
    };

/** Axis-aligned rectangle on the XZ plane. */
export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export type BlockMaterial = "concrete" | "metal" | "glass" | "asphalt";

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * A skin for a block (ADR-0022): what it looks like, which side faces the street and, optionally,
 * how far the facades across the street are and whether the renderer may hang its own signs.
 */
export const skin = (style: BlockStyle, front: BlockFront, extra: { readonly street?: number; readonly signs?: boolean } = {}): BlockSkin => ({
  style,
  front,
  ...(extra.street === undefined ? {} : { street: extra.street }),
  ...(extra.signs === undefined ? {} : { signs: extra.signs }),
});

export const building = (x: number, z: number, w: number, h: number, d: number, material: BlockMaterial = "concrete", look?: BlockSkin): StaticProp => ({
  center: v(x, h / 2, z),
  view: look ? { kind: "block", size: v(w, h, d), material, skin: look } : { kind: "block", size: v(w, h, d), material },
  solid: true,
});

export const crate = (x: number, z: number, w: number, h: number, d: number, look?: BlockSkin): StaticProp => ({
  center: v(x, h / 2, z),
  view: look ? { kind: "block", size: v(w, h, d), material: "metal", skin: look } : { kind: "block", size: v(w, h, d), material: "metal" },
  solid: true,
});

/** Visual-only slab (ground, sidewalks, awnings, overhead decks). */
export const slab = (x: number, y: number, z: number, size: Vec3, material: BlockMaterial): StaticProp => ({
  center: v(x, y, z),
  view: { kind: "block", size, material },
  solid: false,
});

/**
 * Neon sign. Thin along X: a vertical sign on a facade, facing west when x > 0 (east when x < 0).
 * Otherwise it faces south (-Z), so labelled signs belong on north sides of east-west streets.
 */
export const neon = (x: number, y: number, z: number, size: Vec3, color: string, label?: string): StaticProp => ({
  center: v(x, y, z),
  view: label === undefined ? { kind: "neon", size, color } : { kind: "neon", size, color, label },
  solid: false,
});

/** Open water over the rectangle, its surface at `y` (ADR-0024). Visual only. */
export const water = (x0: number, x1: number, z0: number, z1: number, y: number): StaticProp => ({
  center: v((x0 + x1) / 2, y, (z0 + z1) / 2),
  view: { kind: "water", size: v(x1 - x0, 0.01, z1 - z0) },
  solid: false,
});

/** Street lamp; also a point light. The arm points west when x > 0. */
export const lamp = (x: number, z: number, color: string): StaticProp => ({
  center: v(x, 0, z),
  view: { kind: "lamp", color },
  solid: false,
});

/** Box spanning the given ranges, solid by default. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial, solid = true): StaticProp => ({
  center: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material },
  solid,
});

/** Walkable slab whose top is at `top` (a bridge deck, a landing, a walkway). */
export const deck = (x0: number, x1: number, z0: number, z1: number, top: number, thickness = 0.3, material: BlockMaterial = "concrete"): StaticProp =>
  box(x0, x1, top - thickness, top, z0, z1, material);

/** Railing standing on a floor at height `floor`. */
export const rail = (x0: number, x1: number, z0: number, z1: number, floor: number, height = 1.05): StaticProp => box(x0, x1, floor, floor + height, z0, z1, "metal");

/** Stair rise per step, metres; also the visual step count. */
const STEP_RISE = 0.25;

/**
 * Stairs from `y0` to `y1` over the rectangle, rising along `axis` towards `dir` (ADR-0020).
 * Solid underneath, drawn as steps; the walkable surface is the ramp through the step noses.
 */
export const stairs = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, axis: "x" | "z", dir: 1 | -1): StaticProp => {
  const b = box(x0, x1, y0, y1, z0, z1, "concrete");
  return { ...b, view: { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material: "concrete", slope: { axis, dir, low: 0, steps: Math.max(1, Math.round((y1 - y0) / STEP_RISE)) } } };
};

/** Railing along a flight of stairs: a thin wall whose top follows the stairs `height` above them. */
export const stairRail = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, axis: "x" | "z", dir: 1 | -1, height = 1.05): StaticProp => {
  const b = box(x0, x1, y0, y1 + height, z0, z1, "metal");
  return { ...b, view: { kind: "block", size: v(x1 - x0, y1 + height - y0, z1 - z0), material: "metal", slope: { axis, dir, low: height } } };
};

/** An automatic door (ADR-0038): `doorParts` in doors.ts turns it into props. */
export interface DoorDef {
  readonly key: string;
  /** Middle of the opening, at floor height. */
  readonly at: Vec3;
  /** The wall the door sits in runs along this axis; the leaves slide along it. */
  readonly along: "x" | "z";
  /** Width of the opening, metres. */
  readonly width: number;
  readonly height: number;
  readonly leaves: 1 | 2;
  /** A single leaf slides this way along `along`. */
  readonly dir?: 1 | -1;
  /** Thickness of a leaf; it hides in the wall's thickness when open. */
  readonly thickness?: number;
  readonly material?: BlockMaterial;
  readonly lock?: DoorLock;
  /** Where the lock's panel hangs (a coded door). */
  readonly panel?: Vec3;
}

/** A lift between levels (ADR-0020): parts of the platform, gates and call buttons. */
export interface LiftDef {
  readonly key: string;
  /** Platform rectangle. */
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Floor heights served, lowest first. */
  readonly levels: readonly [number, ...number[]];
  /** Gate rectangles closing the shaft at each upper level (index 1..). */
  readonly gates: readonly { readonly level: number; readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }[];
  /** Call buttons: where they hang (centre) and on which level. */
  readonly buttons: readonly { readonly level: number; readonly at: Vec3 }[];
}

const PLATFORM_THICKNESS = 0.3;
const GATE_HEIGHT = 1.1;
const LIFT_SPEED = 2.5;

export const liftParts = (l: LiftDef): StaticProp[] => {
  const base = l.levels[0];
  const platform = box(l.x0, l.x1, base - PLATFORM_THICKNESS, base, l.z0, l.z1, "metal");
  return [
    { ...platform, mechanism: { kind: "platform", key: l.key, levels: l.levels, speed: LIFT_SPEED } },
    ...l.gates.map((g): StaticProp => {
      const floor = l.levels[g.level] ?? base;
      return { ...box(g.x0, g.x1, floor, floor + GATE_HEIGHT, g.z0, g.z1, "glass"), mechanism: { kind: "gate", elevator: l.key, level: g.level, travel: GATE_HEIGHT } };
    }),
    ...l.buttons.map((b): StaticProp => ({
      center: b.at,
      view: { kind: "block", size: v(0.22, 0.32, 0.22), material: "glass" },
      solid: false,
      mechanism: { kind: "button", elevator: l.key, level: b.level },
    })),
  ];
};

/** Rung spacing of a ladder, metres. */
const RUNG_SPACING = 0.3;
/** The ladder hangs this far in front of the climber's centre (between her and the wall). */
const LADDER_OFFSET = 0.32;
/** Rails reach this far above the top, as a handhold for stepping off. */
const LADDER_HANDHOLD = 1;

/**
 * A fire escape ladder (ADR-0021): the visual rails and rungs (not solid, the wall behind is),
 * and the two grab points the interact key uses, at the foot and where the climber steps off at
 * the top.
 */
export const ladderParts = (l: LadderDef): StaticProp[] => {
  const alongX = Math.abs(Math.sin(l.yaw)) > 0.5;
  const h = l.top - l.bottom + LADDER_HANDHOLD;
  const size = alongX ? v(0.08, h, 0.6) : v(0.6, h, 0.08);
  const rungs = Math.max(2, Math.round(h / RUNG_SPACING));
  return [
    {
      center: v(l.x + Math.sin(l.yaw) * LADDER_OFFSET, l.bottom + h / 2, l.z + Math.cos(l.yaw) * LADDER_OFFSET),
      view: { kind: "block", size, material: "metal", rungs },
      solid: false,
      mechanism: { kind: "ladder", ladder: l },
    },
    { center: v(l.x, l.bottom, l.z), view: { kind: "block", size: v(0.01, 0.01, 0.01), material: "metal" }, solid: false, mechanism: { kind: "ladder-end", ladder: l.key, end: "bottom" } },
    { center: l.exit, view: { kind: "block", size: v(0.01, 0.01, 0.01), material: "metal" }, solid: false, mechanism: { kind: "ladder-end", ladder: l.key, end: "top" } },
  ];
};

/** A transition point of the level graph (ADR-0021): `at.y` is the floor height there. */
export interface NavNode {
  readonly id: string;
  readonly at: Vec3;
}

/**
 * A straight walk between two nodes. `via` is the footprint of the flight of stairs the edge
 * climbs: anyone standing in it is on the way between the two ends.
 */
export interface NavEdge {
  readonly a: string;
  readonly b: string;
  readonly via?: Rect;
}

/** Where NPCs can change level in a district: stairs and the floor around them. No lifts, no ladders. */
export interface NavGraph {
  readonly nodes: readonly NavNode[];
  readonly edges: readonly NavEdge[];
}

export const mergeNav = (...graphs: readonly NavGraph[]): NavGraph => ({ nodes: graphs.flatMap((g) => g.nodes), edges: graphs.flatMap((g) => g.edges) });

/**
 * A hand-made set piece moved into the city (ADR-0045): content drawn around its own origin,
 * shifted by `d` (the district's place in Lublin, `d.y` the level of its flattened ground).
 */
export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A point of a set piece in the world. */
export const placeAt = (d: Placement, p: Vec3): Vec3 => v(p.x + d.x, p.y + d.y, p.z + d.z);

/** A rectangle of a set piece in the world. */
export const placeRect = (d: Placement, r: Rect): Rect => ({ minX: r.minX + d.x, maxX: r.maxX + d.x, minZ: r.minZ + d.z, maxZ: r.maxZ + d.z });

/** A spawn of a set piece in the world. */
export const placeSpawn = <T extends ActorSpawn>(d: Placement, s: T): T => ({ ...s, position: placeAt(d, s.position) });

/** An actor of a set piece in the world. */
export const placeActor = (d: Placement, a: ActorDef): ActorDef => (a.kind === "npc" ? { ...a, spawn: placeSpawn(d, a.spawn) } : { ...a, spawn: placeSpawn(d, a.spawn) });

/** A door of a set piece in the world. */
export const placeDoor = (d: Placement, door: DoorDef): DoorDef => ({ ...door, at: placeAt(d, door.at), ...(door.panel ? { panel: placeAt(d, door.panel) } : {}) });

const placeLadder = (d: Placement, l: LadderDef): LadderDef => ({ ...l, x: l.x + d.x, z: l.z + d.z, bottom: l.bottom + d.y, top: l.top + d.y, exit: placeAt(d, l.exit) });

const placeMechanism = (d: Placement, m: Mechanism): Mechanism => {
  switch (m.kind) {
    case "platform": {
      const [first, ...rest] = m.levels;
      return { ...m, levels: [first + d.y, ...rest.map((l) => l + d.y)] };
    }
    case "ladder":
      return { ...m, ladder: placeLadder(d, m.ladder) };
    case "door":
      return { ...m, door: placeDoor(d, m.door) };
    default:
      return m;
  }
};

/**
 * A prop of a set piece in the world. Signs and lamps keep facing the way they did around the
 * set piece's own origin (the renderer would otherwise turn them by the sign of the world x).
 */
export const placeProp = (d: Placement, p: StaticProp): StaticProp => {
  let view = p.view;
  const thinX = view.kind === "neon" && view.size.x <= view.size.z && view.size.x <= view.size.y;
  if ((thinX || view.kind === "lamp") && (view.kind === "neon" || view.kind === "lamp") && !view.facing) view = { ...view, facing: p.center.x > 0 ? "x-" : "x+" };
  return { ...p, center: placeAt(d, p.center), view, ...(p.mechanism ? { mechanism: placeMechanism(d, p.mechanism) } : {}) };
};

export const placeProps = (d: Placement, props: readonly StaticProp[]): StaticProp[] => props.map((p) => placeProp(d, p));

/** A level graph of a set piece in the world. */
export const placeNav = (d: Placement, g: NavGraph): NavGraph => ({
  nodes: g.nodes.map((n) => ({ ...n, at: placeAt(d, n.at) })),
  edges: g.edges.map((e) => (e.via ? { ...e, via: placeRect(d, e.via) } : e)),
});
