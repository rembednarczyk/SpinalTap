import { BASE_RAM, type HackTargetKind, QUICKHACKS, type QuickhackId, RAM_REGEN_PER_SECOND, quickhacksFor } from "./quickhacks";

/**
 * The cyberdeck's state (ADR-0029): RAM and the upload in progress. Saved in the domain state,
 * so a game saved mid-upload finishes it after the load.
 */
export interface Upload {
  readonly hackId: QuickhackId;
  /**
   * The target: an entity key, a reinforcement's `security:<n>`, or `#<id>` for another unkeyed one,
   * good only in the session that started it (a loaded game cuts it off, G-194).
   */
  readonly target: string;
  /** Seconds left to the effect. */
  readonly left: number;
  /** RAM paid at the start; half of it comes back when the upload is cut off. */
  readonly ram: number;
}

export interface NetrunState {
  /** RAM available, fractional while it regenerates. */
  readonly ram: number;
  readonly upload: Upload | null;
}

export const INITIAL_NETRUN: NetrunState = { ram: BASE_RAM, upload: null };

/** Hacks that fit a kind of target: the scanner's list, shared with the HUD (`quickhacksFor`). */
export const hacksFor = (kind: HackTargetKind): readonly QuickhackId[] => quickhacksFor(kind);

/** The n-th hack (1-based) of the target's list, or null past its end. */
export const hackInSlot = (kind: HackTargetKind, slot: number): QuickhackId | null => hacksFor(kind)[slot - 1] ?? null;

/** RAM a hack costs; the ICEpick daemon of a breached network takes one off (never below 1). */
export const hackCost = (id: QuickhackId, icepick: boolean): number => Math.max(1, QUICKHACKS[id].ram - (icepick ? 1 : 0));

/** RAM after `dt` seconds of regeneration, capped at `max`. */
export const regenRam = (ram: number, max: number, dt: number): number => Math.min(max, ram + RAM_REGEN_PER_SECOND * dt);

/** RAM given back for an upload cut off before its effect. */
export const refundOf = (upload: Upload): number => upload.ram / 2;

// Numbers of the scanner and the effects (ADR-0029).

/** Time scale of the world while the scanner is held (the overdrive's is 0.3). */
export const SCAN_TIME_SCALE = 0.6;
/** The scanner reaches this far, in a cone of this half-angle around the look direction. */
export const SCAN_RANGE = 25;
export const SCAN_CONE = 0.3;
/** Damage of `short_circuit` on a person. */
export const SHORT_CIRCUIT_DAMAGE = 35;
/** `ping` marks the target's network: its faction's people and cameras this close to it. */
export const PING_RADIUS = 30;
/** `distract` draws guards from this far to the device. */
export const DISTRACT_RADIUS = 14;
/** RAM does not come back while an enemy this close is fighting the player. */
export const COMBAT_RADIUS = 40;
