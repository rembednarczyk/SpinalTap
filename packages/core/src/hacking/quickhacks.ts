/**
 * Quickhacks (ADR-0028): actions on devices and people through the scanner, paid in RAM from
 * the cyberdeck. The table is the contract between the simulation (which applies them), the UI
 * (which lists them in scan mode) and the engine (which shows the upload). Numbers are starting
 * values, tuned in the simulation's balance tests.
 */
export type QuickhackCategory = "covert" | "control" | "combat";

/** What a quickhack can be uploaded into. */
export type HackTargetKind = "camera" | "device" | "person";

export interface QuickhackDef {
  readonly id: string;
  readonly title: string;
  readonly category: QuickhackCategory;
  readonly targets: readonly HackTargetKind[];
  /** RAM taken when the upload starts. */
  readonly ram: number;
  /** Seconds from the start of the upload to the effect; the target must stay scanned and in range. */
  readonly upload: number;
  /** Seconds the effect lasts; 0 for an instant one. */
  readonly duration: number;
}

export const QUICKHACKS = {
  /** Shows every enemy and camera wired to the same network as the target for a while. */
  ping: { id: "ping", title: "Ping", category: "covert", targets: ["camera", "device", "person"], ram: 2, upload: 0.6, duration: 12 },
  /** A camera stops seeing; a guard's optics go dark and he loses track of the player. */
  reboot_optics: { id: "reboot_optics", title: "Restart optyki", category: "covert", targets: ["camera", "person"], ram: 3, upload: 1, duration: 10 },
  /** A device (a vending machine, a radio, a sign) makes noise: guards nearby go to look. */
  distract: { id: "distract", title: "Odwrócenie uwagi", category: "covert", targets: ["device"], ram: 2, upload: 0.8, duration: 8 },
  /** The target cannot walk for a while. */
  cripple_movement: { id: "cripple_movement", title: "Paraliż ruchu", category: "control", targets: ["person"], ram: 4, upload: 1.2, duration: 6 },
  /** Damage through the implants; shocks a device into a short circuit. */
  short_circuit: { id: "short_circuit", title: "Zwarcie", category: "combat", targets: ["person", "device"], ram: 5, upload: 1.5, duration: 0 },
} as const satisfies Record<string, QuickhackDef>;

export type QuickhackId = keyof typeof QUICKHACKS;

export const QUICKHACK_IDS = Object.keys(QUICKHACKS) as QuickhackId[];

/** Most quickhacks the scanner lists at once (keys 1..5). */
export const MAX_QUICKHACK_SLOTS = 5;

/**
 * The scanner's list for a kind of target, in table order. `InputFrame.quickhack` n picks the
 * n-th entry; the simulation and the HUD both use this list, so a key always means the same hack.
 */
export const quickhacksFor = (kind: HackTargetKind): QuickhackId[] =>
  QUICKHACK_IDS.filter((id) => (QUICKHACKS[id].targets as readonly HackTargetKind[]).includes(kind)).slice(0, MAX_QUICKHACK_SLOTS);

/** RAM of the starting cyberdeck and its regeneration per second outside combat. */
export const BASE_RAM = 8;
export const RAM_REGEN_PER_SECOND = 0.5;

/** Why an upload did not go through. */
export type QuickhackFailure = "no-ram" | "out-of-range" | "lost-target" | "wrong-target" | "busy";

/** Daemons won in the terminal minigame (ADR-0028): each one shapes the rest of the network. */
export type BreachDaemonId = "icepick" | "datamine" | "mass_vulnerability";
