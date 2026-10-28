/**
 * Crime, witnesses and heat (ADR-0028). A crime exists only once someone saw it: a civilian who
 * then phones it in, a camera, or a patrol. Heat is the district security's pursuit of the
 * player, from 0 (none) to 3, and drops after the player stays out of sight long enough.
 */
export type CrimeKind = "gunfire" | "assault" | "murder" | "trespass" | "hacking";

/** How a crime reached the security: a civilian's call takes a few seconds and can be cut off. */
export type WitnessChannel = "civilian" | "camera" | "patrol";

export type HeatLevel = 0 | 1 | 2 | 3;

export const MAX_HEAT: HeatLevel = 3;

/** How the people on the street respond to a disturbance (ADR-0028), in order of fear. */
export type CrowdState = "calm" | "alarmed" | "fleeing" | "cowering";

/** What made the street notice: the sound or sight of it, heard up to `radius` metres away. */
export type DisturbanceKind = "gunshot" | "fight" | "body" | "alarm" | "hack";
