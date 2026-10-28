import type { ContractVariationVm } from "./wave2-vm";
import type { AwarenessState, BreachDaemonId, ContractBadge, ContractRank, HackTargetKind, HeatLevel, PhonePriority, QuickhackId } from "@seki/core";

/**
 * View models of wave 1 (ADR-0028): phone, contract debrief, heat and detection, scanner and
 * quickhacks, the breach minigame, combat feedback and the accessibility settings. The app fills
 * them from domain events; the UI only reads them.
 */

// ---- phone ----

export interface PhoneLineVm {
  readonly speaker: string | null;
  readonly text: string;
}

export interface PhoneMessageVm {
  readonly id: number;
  /** Contact id from the event (`kaito`, `hana`...). */
  readonly from: string;
  /** Display name of the contact. */
  readonly contact: string;
  readonly kind: "text" | "call";
  readonly priority: PhonePriority;
  /** The ink knot rendered by the app. */
  readonly lines: readonly PhoneLineVm[];
  /** Game time it came in, "HH:MM". */
  readonly time: string;
}

/** All messages of one contact, newest last. */
export interface PhoneThreadVm {
  readonly contact: string;
  readonly from: string;
  readonly messages: readonly PhoneMessageVm[];
  readonly unread: number;
}

export interface PhoneVm {
  /** Threads with the latest message first. */
  readonly threads: readonly PhoneThreadVm[];
  readonly unread: number;
}

export const EMPTY_PHONE: PhoneVm = { threads: [], unread: 0 };

/**
 * What the phone shows on top of the HUD right now: a holocall (story, interrupts) or a short
 * notification (contract and info messages, one at a time, only when it is quiet).
 */
export interface PhoneNoticeVm {
  readonly message: PhoneMessageVm;
  readonly holocall: boolean;
}

// ---- contracts ----

export interface DebriefBadgeVm {
  readonly id: ContractBadge;
  readonly earned: boolean;
  /** The fixer pays extra for it. */
  readonly style: boolean;
}

export interface ContractDebriefVm {
  readonly contractId: string;
  readonly title: string;
  /** The fixer who paid, e.g. "Kaito". */
  readonly fixer: string | null;
  readonly badges: readonly DebriefBadgeVm[];
  readonly rank: ContractRank;
  readonly reward: number;
  readonly bonus: number;
  readonly styleBonus: number;
  readonly seconds: number;
  /** The contract's variation when the simulation reports one (ADR-0032). */
  readonly variation?: ContractVariationVm;
}

/** The running contract's optional condition, next to the objective. */
export interface ContractBonusVm {
  readonly label: string;
  readonly badge: ContractBadge;
  readonly bonus: number;
  readonly kept: boolean;
}

// ---- heat and detection ----

export interface HeatVm {
  readonly level: HeatLevel;
  /** The security lost sight of the player and looks around the last known position. */
  readonly searching: boolean;
  /** Only a few seconds of the search are left: the stars blink before the level drops. */
  readonly ending: boolean;
}

export const NO_HEAT: HeatVm = { level: 0, searching: false, ending: false };

/** One observer around the crosshair: where it is and how full its suspicion is. */
export interface DetectionVm {
  readonly id: number;
  /** Radians on screen: 0 straight ahead (up), positive to the right. */
  readonly angle: number;
  /** 0..1. */
  readonly level: number;
  readonly state: Exclude<AwarenessState, "unaware">;
}

export interface MapPointVm {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

// ---- scanner and quickhacks ----

export interface ScanTargetVm {
  readonly id: number;
  readonly kind: HackTargetKind;
  readonly name: string;
  /** Faction or owner, null when nobody claims it. */
  readonly faction: string | null;
  /** A passer-by's short profile (Watch Dogs 2 style), null for devices. */
  readonly profile: readonly string[] | null;
  /** The target is hostile (threat token) or not. */
  readonly hostile: boolean;
}

export interface RamVm {
  readonly current: number;
  readonly max: number;
}

export interface UploadVm {
  /** Bumped per upload so the bar restarts. */
  readonly seq: number;
  readonly hackId: QuickhackId;
  readonly seconds: number;
}

export interface ScanNoteVm {
  readonly seq: number;
  readonly tone: "ok" | "fail" | "traced";
  readonly text: string;
}

/** A terminal breach in progress (the UI plays it). */
export interface BreachVm {
  readonly terminalKey: string;
  /** Daemons on offer, 1..3. */
  readonly daemons: readonly BreachDaemonId[];
}

// ---- combat feedback ----

export type HitKind = "hit" | "crit" | "kill";

export type DamageNumbersMode = "off" | "hit" | "total";

export interface DamageNumberVm {
  readonly id: number;
  readonly amount: number;
  readonly critical: boolean;
  /** Bumped when a total grows, so the number pops again. */
  readonly rev: number;
}

// ---- accessibility ----

export type ColorblindMode = "off" | "protan" | "deutan" | "tritan";

/** HUD scale range of the settings. */
export const HUD_SCALE_RANGE: readonly [number, number] = [0.8, 1.4];
