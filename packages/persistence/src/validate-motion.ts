type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isTime = (v: unknown): boolean => isNum(v) && v >= 0;
const isShare = (v: unknown): boolean => isNum(v) && v >= 0 && v <= 1;
const isBool = (v: unknown): boolean => typeof v === "boolean";
const isVec = (v: unknown): boolean => isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const optional = (v: unknown, ok: (v: unknown) => boolean): boolean => v === undefined || ok(v);

const MELEE_PHASES: readonly unknown[] = ["idle", "windup", "recovery"];

/** G-883: a blow in progress; the phase's time may end a hair below 0 within a step. */
const isMelee = (v: unknown): boolean =>
  isObject(v) &&
  MELEE_PHASES.includes(v.phase) &&
  isNum(v.timer) &&
  Number.isInteger(v.strike) &&
  (v.strike as number) >= 0 &&
  (["combo", "stagger", "parry", "parryCooldown"] as const).every((k) => isTime(v[k])) &&
  (["queued", "stunned", "guard"] as const).every((k) => isBool(v[k])) &&
  isObject(v.knock) &&
  isNum(v.knock.x) &&
  isNum(v.knock.z) &&
  isTime(v.knock.time);

const isPerks = (v: unknown): boolean =>
  isObject(v) &&
  (["dash", "dashCooldown", "iframes", "secondHeart"] as const).every((k) => isTime(v[k])) &&
  isObject(v.dashDir) &&
  isNum(v.dashDir.x) &&
  isNum(v.dashDir.z) &&
  isBool(v.airDash) &&
  isBool(v.dashFlight) &&
  isShare(v.stamina);

const isJump = (v: unknown): boolean => isObject(v) && isTime(v.coyote) && isTime(v.buffer);

/** G-913: the step onto a ladder's rungs, `t` of its `duration` gone. */
const isLadderSettle = (v: unknown): boolean =>
  isObject(v) &&
  typeof v.ladder === "string" &&
  isVec(v.from) &&
  isNum(v.fromYaw) &&
  isNum(v.y) &&
  isBool(v.over) &&
  isNum(v.duration) &&
  v.duration > 0 &&
  isTime(v.t) &&
  (v.t as number) <= v.duration;

/** G-883: the player's posture, gun, time in the air and dash; G-913: her step onto a ladder. */
const isStance = (v: unknown): boolean =>
  isObject(v) &&
  (["crouched", "sprinting", "aiming", "holstered"] as const).every((k) => isBool(v[k])) &&
  isShare(v.crouch) &&
  isShare(v.aim) &&
  (["reloading", "drawing", "bloom"] as const).every((k) => isTime(v[k])) &&
  optional(v.fall, isNum) &&
  optional(v.airPeak, isNum) &&
  optional(v.landing, isTime) &&
  optional(v.jump, isJump) &&
  optional(v.perks, isPerks) &&
  optional(v.ladderSettle, isLadderSettle);

/** What a fight leaves on an entity between two steps (G-883, v41): its velocity, its blow and, the player's only, her stance. */
export const findMotionError = (e: Json): string | null => {
  if (!optional(e.velocity, isVec)) return `entity ${String(e.key)} velocity`;
  if (!optional(e.melee, isMelee)) return `entity ${String(e.key)} melee`;
  if (e.stance !== undefined && (e.key !== "player" || !isStance(e.stance))) return `entity ${String(e.key)} stance`;
  return null;
};
