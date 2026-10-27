import type { FactionId, Vec3, ViewDescriptor } from "@seki/core";
import type { Interactable } from "../world/components";

/** Shared vocabulary of the content tables. Coordinates: Y up, +Z north, yaw 0 faces +Z. */
export interface StaticProp {
  readonly center: Vec3;
  readonly view: ViewDescriptor;
  readonly solid: boolean;
  /** Moving part of a lift (ADR-0020); the prop is then kinematic. */
  readonly mechanism?: Mechanism;
}

/** Parts of a lift: the platform (a solid), the gates at upper levels and the call buttons. */
export type Mechanism =
  | { readonly kind: "platform"; readonly key: string; readonly levels: readonly [number, ...number[]]; readonly speed: number }
  | { readonly kind: "gate"; readonly elevator: string; readonly level: number; readonly travel: number }
  | { readonly kind: "button"; readonly elevator: string; readonly level: number };

export interface ActorSpawn {
  readonly key: string;
  readonly position: Vec3;
  readonly yaw: number;
}

export interface GangerSpawn extends ActorSpawn {
  readonly tag: string | null;
}

/** A keyed character placed by content. Its state survives unloading and saves. */
export type ActorDef =
  | {
      readonly kind: "npc";
      readonly spawn: ActorSpawn;
      readonly preset: "fixer" | "civilian" | "ripperdoc";
      readonly faction: FactionId;
      readonly interactable?: Interactable;
      /** Bystander AI: keeps to its spot, flees a player the street fears. */
      readonly bystander?: true;
      /** Gives the NPC health, so it can be hurt and killed. NPCs without it cannot be. */
      readonly maxHp?: number;
    }
  | { readonly kind: "ganger"; readonly spawn: GangerSpawn };

/** Axis-aligned rectangle on the XZ plane. */
export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export type BlockMaterial = "concrete" | "metal" | "glass" | "asphalt";

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const building = (x: number, z: number, w: number, h: number, d: number, material: BlockMaterial = "concrete"): StaticProp => ({
  center: v(x, h / 2, z),
  view: { kind: "block", size: v(w, h, d), material },
  solid: true,
});

export const crate = (x: number, z: number, w: number, h: number, d: number): StaticProp => ({
  center: v(x, h / 2, z),
  view: { kind: "block", size: v(w, h, d), material: "metal" },
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
