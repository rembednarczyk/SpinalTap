import type { ContractKind, FactionId, MetroStationId, ShopId, Vec3 } from "@seki/core";
import type { Aabb } from "../collision";

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
  /**
   * What the HUD offers, as a key of the app's catalogs (`prompt.talk.kaito`), never as text:
   * the app writes it in the player's language (ADR-0056).
   */
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
