import type {
  ActivityId,
  ContractKind,
  CrimeKind,
  CrowdState,
  EnemyTypeId,
  EntityId,
  FactionId,
  Health,
  MetroStationId,
  ShopId,
  Slope,
  Vec3,
  ViewDescriptor,
  WeaponId,
  WeaponSlot,
  WeaponStats,
} from "@seki/core";
import type { ActivityPlan, Passerby } from "./activity-types";
import type { Aabb } from "./collision";
import type { Prism } from "./prism";

export interface CharacterBody {
  readonly radius: number;
  readonly height: number;
}

/**
 * Weapon state of a character (ADR-0015). For the player the domain is the source of truth
 * (equipment, the weapon instance and its loaded rounds, the ammo pouch); `weapon`, `uid` and
 * `stats` are a cache that `syncPlayerWeapon` refreshes every step. NPCs keep everything here.
 */
export interface Combatant {
  /** Weapon in the active slot, null when that slot is empty. */
  weapon: WeaponId | null;
  /** Its effective stats (the player's with rarity and mods, NPCs' from the `npc` profile). */
  stats: WeaponStats | null;
  /** The player's active weapon instance; undefined before the first sync, null for NPCs. */
  uid?: string | null;
  slot: WeaponSlot;
  /** Rounds in the magazine of an NPC. Not saved: NPC magazines come back full. */
  loaded: number;
  /** Seconds left of a reload step, 0 when not reloading. Not saved. */
  reloading: number;
  /** Seconds until the next shot is allowed. */
  cooldown: number;
  /** Weapon put away: no shots until drawn again. Presentation-only otherwise; not saved. */
  holstered: boolean;
  /** Seconds left of the draw; shots wait for it. */
  drawing: number;
  /** Extra spread from recent shots in radians; recovers over time. Not saved (ADR-0016). */
  bloom: number;
  /** An NPC that is fighting this step holds its weapon up (presentation only, not saved). */
  engaged?: boolean;
}

/**
 * Melee state of a combatant (ADR-0019): the swing in progress, the combo, the guard and
 * stagger. Transient like the holster and the bloom: not saved, a loaded game starts idle.
 */
export interface MeleeState {
  /** "windup": the swing is on its way and lands when `timer` runs out; "recovery": it landed. */
  phase: "idle" | "windup" | "recovery";
  /** Seconds left of the phase. */
  timer: number;
  /** Index of the current (or last) strike in the weapon's combo. */
  strike: number;
  /** Seconds left in which the next swing continues the combo. */
  combo: number;
  /** The attack button was held during recovery: the next swing starts right after it. */
  queued: boolean;
  /** Seconds left staggered: no swing, no guard, no shot, slow feet. */
  stagger: number;
  /** Guard up (the aim button with a melee weapon). */
  guard: boolean;
  /** Seconds left of the parry window opened by raising the guard. */
  parry: number;
  /** Seconds until raising the guard opens a parry window again. */
  parryCooldown: number;
  /** Knockback of an unguarded hit: ground velocity (m/s) for `time` more seconds. */
  knock: { x: number; z: number; time: number };
}

/**
 * How the character holds itself (ADR-0016). Transient like the holster: not saved, a loaded
 * game starts standing.
 */
export interface Posture {
  /** Wants to crouch (the input is held). */
  crouched: boolean;
  /** 0 standing .. 1 fully crouched, eased towards `crouched` over CROUCH_TIME. */
  amount: number;
  /** `amount` at the previous step, for interpolated rendering. */
  prevAmount: number;
  /** Sprinting this step (widens the aim cone). */
  sprinting: boolean;
  /** Wants to aim down sights this step (ADR-0019). */
  aiming: boolean;
  /** 0 from the hip .. 1 fully aimed, eased over the weapon's `ads.time`. */
  aim: number;
  /** `aim` at the previous step, for interpolated rendering. */
  prevAim: number;
}

export interface GangerAi {
  readonly home: Vec3;
  readonly aggroRange: number;
  readonly attackRange: number;
  /**
   * Set once the ganger has decided to fight the player; never resets. Gangers friendly to
   * the player only set it when provoked (gunfire nearby or a hit).
   */
  alerted: boolean;
  /**
   * Key of the NPC this ganger was sent to kill (a protection job's wave, an escort's ambush).
   * It goes for the victim, and turns on the player only once alerted and with the player in
   * sight and range.
   */
  readonly victim?: string;
  /**
   * Corporate guard (ADR-0024): sees only in front of it, notices a crouching player late and
   * needs a moment of looking before it raises the alarm. Without it the ganger sees all round
   * and decides at once, as before.
   */
  readonly cone?: true;
  /** How sure the guard is that it saw someone, 0..1; at 1 it is alerted. Transient, not saved. */
  suspicion?: number;
  /** A guard on a post looks around: its facing sweeps around `yaw` (ADR-0024). */
  readonly watch?: { readonly yaw: number; readonly phase: number; readonly period?: number };
  /**
   * Where it last saw the player, or a lead it was given (a noise, a camera, a trace) (ADR-0029).
   * An alerted AI chases it once the player is out of sight; an unalerted one walks there to
   * look. Saved with the entity.
   */
  lastKnown?: Vec3 | null;
  /** Seconds it still looks around `lastKnown` before going back to its post. Saved. */
  search?: number;
  /** Seconds the player has been out of its sight while alerted. Transient. */
  lost?: number;
  /** It saw the player this step (read by the heat after the AI ran). Transient. */
  sees?: boolean;
  /**
   * Sees through disguises (ADR-0033): a Tessen shift boss, every third Hebi. Fixed at spawn
   * from the key, so it needs no saving.
   */
  readonly enforcer?: true;
  /**
   * A street patrol on its own ground (ADR-0048): Hebi walking the Old Town among the people
   * who live there. Neutral to the player, it keeps an eye on her instead of attacking; a hostile
   * standing, the heat's hunt, a blown disguise of its faction or a provocation alert it like
   * any ganger. Fixed by content, so it needs no saving.
   */
  readonly patrol?: true;
}

/**
 * A sniper (ADR-0024): no behaviour tree, a small state machine. It keeps to a perch high up,
 * aims for `AIM_TIME` with the laser on (the telegraph), fires, waits, and walks to the perch
 * farthest from the player once the player gets close. Transient like the melee state: a game
 * loaded mid-aim starts idle on its saved position.
 */
export interface SniperState {
  readonly perches: readonly Vec3[];
  phase: "idle" | "aim" | "rest" | "move";
  /** Seconds left of the aim or the rest. */
  timer: number;
  /** Perch it holds or walks to (index into `perches`). */
  perch: number;
}

/** A defector walked to the boat (ADR-0024): follows `route` while the player is close. */
export interface EscortAi {
  readonly route: readonly [Vec3, ...Vec3[]];
}

/**
 * A bystander that keeps to its spot (or its daily plan), runs from a player the street fears
 * and reacts to disturbances (ADR-0029). `crowd` is transient: a loaded game starts calm.
 */
export interface CivilianAi {
  readonly home: Vec3;
  crowd?: CrowdMind;
}

/** A bystander's reaction to the street (ADR-0029). Transient, not saved. */
export interface CrowdMind {
  state: CrowdState;
  /** Seconds left of the state; at 0 it calms down one step (cowering, then fleeing, then calm). */
  timer: number;
  /** What it reacts to (runs away from it, looks at it). */
  from: Vec3;
  /** A call to the security in progress. */
  call: WitnessCall | null;
  /** Seconds left of being too scared to phone (the player aimed at it). */
  scared: number;
}

export interface WitnessCall {
  readonly crime: CrimeKind;
  readonly at: Vec3;
  /** The incident it saw; several witnesses of one incident make one report. */
  readonly incident: number;
  left: number;
}

/** Kinds of hackable things placed in the districts (ADR-0029). */
export type DeviceKind = "camera" | "vending" | "speaker" | "neon";

/**
 * A camera or a device (ADR-0029). A camera sees in a cone in front of it (the entity's yaw) and
 * reports crimes at once; with `restricted`, it also reports the player standing in the zone.
 * Devices make noise when distracted. Timers are transient.
 */
export interface Device {
  readonly kind: DeviceKind;
  /** The network the device is wired to (ping, ICEpick). */
  readonly network: string;
  /** Whose security it reports to. */
  readonly faction: FactionId;
  /** A no-go zone the camera watches; with `during`, only while a contract of that kind runs. */
  readonly restricted?: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly during?: ContractKind };
  /** Camera: 0..1 how sure it is the player is where they should not be. */
  spot: number;
  /** Seconds before the camera reports the trespass again. */
  cooldown: number;
  /** Seconds left of the noise of `distract`. */
  noise: number;
  /** Seconds left knocked out by `short_circuit`. */
  broken: number;
}

/** Quickhack effects on a person or a camera, seconds left (ADR-0029). Transient, not saved. */
export interface HackEffects {
  /** Marked by `ping`: the HUD shows it through walls. */
  pinged: number;
  /** `reboot_optics`: sees nothing. */
  blind: number;
  /** `cripple_movement`: cannot walk. */
  crippled: number;
}

/**
 * One entry of a daily plan. From minute `at` of the day the NPC walks `path` in order,
 * starting where the previous stop left it, and then stays at the last point facing `yaw`.
 * A patrol (`loop`) instead keeps walking `path` as a closed loop until the next stop.
 */
export interface ScheduleStop {
  /** Short name for tests and debugging ("stragan", "dom", "patrol"). */
  readonly label: string;
  /** Minute of the day (0–1439) the NPC sets off. */
  readonly at: number;
  /** Straight-line waypoints; together with the previous stop they must stay clear of solids. */
  readonly path: readonly [Vec3, ...Vec3[]];
  /** Facing once the NPC stands at its stop. */
  readonly yaw: number;
  readonly loop?: true;
  /**
   * What talking to the NPC means while this stop is current: an interaction that replaces
   * the NPC's own (e.g. a closed stall), or null for none. Omitted: the NPC's own.
   */
  readonly interaction?: Interactable | null;
  /** What the NPC does once it stands at the stop (ADR-0040); omitted: it just stands. */
  readonly activity?: ActivityPlan;
}

/** A daily plan: stops sorted by `at`, repeated every day. The day wraps from the last stop to the first. */
export interface ScheduleDef {
  readonly stops: readonly [ScheduleStop, ...ScheduleStop[]];
  /** Walking speed along the path, metres per real second. */
  readonly speed: number;
}

/** Where the plan wants the NPC right now. A pure function of the plan and the clock. */
export interface SchedulePose {
  readonly stop: number;
  readonly position: Vec3;
  /** Direction of travel while walking; the stop's facing once there. */
  readonly heading: number;
  /** Standing at its stop (not walking, not patrolling). */
  readonly arrived: boolean;
}

/**
 * A daily plan (see schedule.ts). Stateless like the rest of the AI: the pose is recomputed
 * from the clock every step, so nothing of it is saved.
 */
export interface Scheduled {
  readonly def: ScheduleDef;
  /** The NPC's own interaction; a stop may replace it while it is current. */
  readonly own: Interactable | null;
  /** Where the plan wants the NPC this step; null until the schedule system first runs. */
  pose: SchedulePose | null;
}

export interface Interactable {
  /**
   * "pickup": taken on the spot (a contract crate); no conversation opens. "loot": a bag;
   * `dialogueId` is then the container key. "terminal": a hack job's terminal, the key starts
   * the hack. Wave 2 (ADR-0034): "metro" is a ticket kiosk of `station`, "read" a mail on a
   * terminal (an observation hook, `dialogueId` its knot), "help" a passer-by in need (a
   * micro-event).
   */
  readonly kind: "dialogue" | "shop" | "pickup" | "loot" | "elevator" | "ladder" | "terminal" | "metro" | "read" | "help" | "door";
  readonly station?: MetroStationId;
  /** For a shop: which one (the clinic when absent). `dialogueId` is then the shopkeeper's ink knot. */
  readonly shopId?: ShopId;
  /** For an elevator call button: which elevator and the level the button stands on. */
  readonly elevator?: { readonly key: string; readonly level: number };
  /** For a ladder's grab point: which ladder and which end (ADR-0021). */
  readonly ladder?: { readonly key: string; readonly end: "bottom" | "top" };
  readonly dialogueId: string;
  readonly prompt: string;
  readonly radius: number;
}

/**
 * A lift platform (ADR-0020): a moving solid whose top is the floor. Not saved: it spawns at
 * the ground level, or at the player's level when the player stands on its footprint.
 */
export interface Elevator {
  readonly key: string;
  /** Heights of the platform top at each level, lowest first. */
  readonly levels: readonly [number, ...number[]];
  /** Metres per second. */
  readonly speed: number;
  /** Level the platform is travelling to (or resting at). */
  target: number;
  /** Placed for the player after spawning. */
  settled: boolean;
}

/** A barrier closing the shaft at an upper level while the platform is elsewhere. */
export interface ElevatorGate {
  readonly elevator: string;
  readonly level: number;
  /** The gate's box while closed; open, it sinks by `travel` into the floor. */
  readonly closed: Aabb;
  readonly travel: number;
}

/**
 * The lock of an automatic door (ADR-0038). "sealed": never opens. "code": opens for the staff of
 * `staff`, and for the player who knows the code of the running job of kind `during` (an
 * observation hook, ADR-0034), wears the staff's overalls (ADR-0033) or broke the lock open at
 * the panel.
 */
export type DoorLock = { readonly kind: "sealed" } | { readonly kind: "code"; readonly staff: FactionId; readonly during: ContractKind };

/** A leaf of an automatic door (ADR-0038). Its state goes into saves under `key`. */
export interface DoorLeaf {
  /** `<door>#<leaf>`. */
  readonly key: string;
  readonly door: string;
  /** The leaf's box while closed; open, it is moved by `slide`. */
  readonly closed: Aabb;
  readonly slide: { readonly x: number; readonly z: number };
  /** Middle of the opening at floor height: the sensor's centre. */
  readonly sensor: Vec3;
  readonly lock?: DoorLock;
  /** 0 closed, 1 open. */
  open: number;
  /** Seconds the sensor has been empty, up to the close delay. */
  idle: number;
}

/**
 * A fire escape ladder (ADR-0021): climbed, not walked on. The climber hangs at (`x`, `z`)
 * facing `yaw` (towards the wall), feet between `bottom` and `top`, and steps off at the top
 * onto `exit`.
 */
export interface LadderDef {
  readonly key: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly bottom: number;
  readonly top: number;
  readonly exit: Vec3;
}

/** A pull-up onto a ledge: from where the hands caught it to standing on top, over `duration` seconds. */
export interface Mantle {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly duration: number;
  t: number;
}

/** Jump timers of the player (ADR-0021). Transient like the posture: not saved. */
export interface JumpState {
  /** Seconds left in which a jump still counts after leaving the ground without one (coyote time). */
  coyote: number;
  /** Seconds left of a press made too early (in the air), so it fires on landing (jump buffer). */
  buffer: number;
}

/**
 * The player's perks in motion (ADR-0033): the dash and the guard's stamina for deflecting
 * bullets. Transient like the jump timers: a loaded game starts rested, with the dash ready.
 */
export interface PerkState {
  /** Seconds left of the dash burst. */
  dash: number;
  /** Direction of the burst on the ground plane (unit). */
  dashDir: { x: number; z: number };
  /** Seconds until the next dash. */
  dashCooldown: number;
  /** The one dash of this time in the air is used; resets on the ground. */
  airDash: boolean;
  /** Seconds left in which shots pass the player by. */
  iframes: number;
  /** 0..1; deflecting a bullet takes some, it comes back over time. */
  stamina: number;
}

/** On a ladder (ADR-0021). Transient; a game saved on a ladder grabs it again on load. */
export interface Climbing {
  readonly ladder: string;
  /** Climbing speed this step, m/s, positive up (for the presentation). */
  speed: number;
}

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
   * What the character does where it stands (ADR-0040), set by the activity system from its
   * plan, its spot or its role. Derived from the clock and the content every step: not saved.
   */
  activity?: ActivityId;
  /** A background passer-by (ADR-0040): unkeyed, not saved, rebuilt from the seed and the clock. */
  passerby?: Passerby;
}
