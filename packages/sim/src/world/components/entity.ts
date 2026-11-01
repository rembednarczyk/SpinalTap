import type { ActivityId, EnemyTypeId, EntityId, FactionId, Health, Slope, Vec3, ViewDescriptor } from "@seki/core";
import type { Passerby } from "../activity-types";
import type { Aabb } from "../collision";
import type { Prism } from "../prism";
import type { CivilianAi, DownedBody, EscortAi, GangerAi, HideKind, SniperState } from "./ai";
import type { CharacterBody, Combatant, MeleeState, Posture } from "./body";
import type { Device, HackEffects } from "./devices";
import type { DoorLeaf, Elevator, ElevatorGate, Interactable, LadderDef } from "./interaction";
import type { Climbing, JumpState, Mantle } from "./movement";
import type { PerkState } from "./perks";
import type { Scheduled } from "./schedule";
import type { VehicleState } from "./vehicle";

/**
 * One ECS entity. Components are optional fields; systems query the ones they need.
 * Hot-path components are mutated in place for performance (see ADR-0002).
 */
export interface Entity {
  readonly id: EntityId;
  /** Stable identity across saves. Only dynamic entities have one. */
  key?: string;
  /** Quest tag reported in EntityKilled. */
  tag?: string;
  /** Streaming chunk the entity belongs to; it leaves the world when that chunk unloads. */
  chunk?: string;
  position: Vec3;
  prevPosition: Vec3;
  yaw: number;
  prevYaw: number;
  pitch: number;
  velocity?: Vec3;
  view?: ViewDescriptor;
  /** Geometry: collides, blocks line of sight and is walked on (ADR-0020). Moves only on lifts and gates. */
  solid?: Aabb;
  /**
   * The solid is made of convex prisms (ADR-0043): a building from map data. `solid` is then
   * their bounding box, the broad phase; collision, rays and the AI's raster use the prisms.
   * Static only: lifts, gates and doors stay boxes.
   */
  prisms?: readonly Prism[];
  /**
   * A piece of street furniture (ADR-0050): a solid for bodies, bullets and the AI, but the TPP
   * camera looks past it (a lamp post between the camera and the player does not pull it in).
   */
  seeThrough?: true;
  /** Sloped top of the solid (stairs, ramps, stair railings). */
  slope?: Slope;
  /** Vertical speed while airborne (a fall, or a jump while positive), m/s. Transient, not saved. */
  fall?: number;
  /** Highest feet height of the current time in the air, for fall damage (ADR-0021). Transient. */
  airPeak?: number;
  /** Seconds left of the slow walk after a hard landing (ADR-0021). Transient. */
  landing?: number;
  jump?: JumpState;
  /** Dash and deflection (ADR-0033), the player only. */
  perks?: PerkState;
  climb?: Climbing;
  /** Pulling up onto a ledge (mantle). Transient, not saved: a game saved mid-mantle loads on the ground below. */
  mantle?: Mantle;
  ladder?: LadderDef;
  elevator?: Elevator;
  gate?: ElevatorGate;
  door?: DoorLeaf;
  /** The lock panel of a coded door (ADR-0038): the door's key. */
  doorPanel?: string;
  body?: CharacterBody;
  posture?: Posture;
  player?: true;
  health?: Health;
  /**
   * The content's own maximum health of a hostile NPC before the difficulty's `npcHealth`
   * (ADR-0066). Transient: rebuilt by `toughen` whenever the entity is made again.
   */
  baseHp?: number;
  /** Who dealt the last damage. Transient (never saved): death is resolved in the same step. */
  lastHitBy?: EntityId;
  faction?: FactionId;
  combatant?: Combatant;
  melee?: MeleeState;
  ai?: GangerAi;
  /** Enemy type (ADR-0015): weapon, outfit and loot table come from it. */
  enemy?: { readonly type: EnemyTypeId };
  civilian?: CivilianAi;
  sniper?: SniperState;
  escort?: EscortAi;
  schedule?: Scheduled;
  interactable?: Interactable;
  /** A bag in the world; its contents live in `domain.loot` under this key. */
  lootBag?: { readonly key: string };
  /** A camera or a hackable device (ADR-0029). */
  device?: Device;
  /** Quickhack effects (ADR-0029). */
  hackFx?: HackEffects;
  /** Sent in by the district's security because of the heat (ADR-0029); unkeyed, not saved. */
  security?: true;
  /** The player hurt it while it was not fighting them: its death is a crime (ADR-0029). Transient. */
  wronged?: true;
  /**
   * Knocked out by a takedown (ADR-0065): lies still, sees and hears nothing, does not fight and
   * is nobody's target. A body killed in a takedown is `unconscious` too, for good. Saved with
   * `downed` (stage 3 of the ADR).
   */
  unconscious?: true;
  /** The finding, the waking, the carrying and the hiding of a body (ADR-0065), with `unconscious`. */
  downed?: DownedBody;
  /** A hiding place for a body (ADR-0065): a container, a dumpster, a locker of the content. */
  hide?: HideKind;
  /**
   * What the character does where it stands (ADR-0040), set by the activity system from its
   * plan, its spot or its role. Derived from the clock and the content every step: not saved.
   */
  activity?: ActivityId;
  /** A background passer-by (ADR-0040): unkeyed, not saved, rebuilt from the seed and the clock. */
  passerby?: Passerby;
  /** A vehicle of the traffic (ADR-0050): unkeyed, not saved, rebuilt from the seed and the clock. */
  vehicle?: VehicleState;
}
