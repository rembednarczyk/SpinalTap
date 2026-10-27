import type { FactionId, Vec3, ViewDescriptor } from "@seki/core";
import type { Interactable } from "../world/components";

/** Shared vocabulary of the content tables. Coordinates: Y up, +Z north, yaw 0 faces +Z. */
export interface StaticProp {
  readonly center: Vec3;
  readonly view: ViewDescriptor;
  readonly solid: boolean;
}

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
