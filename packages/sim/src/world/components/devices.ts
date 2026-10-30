import type { ContractKind, FactionId } from "@seki/core";

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
