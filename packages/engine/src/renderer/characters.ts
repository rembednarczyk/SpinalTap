/**
 * Procedural characters (ADR-0031): the rig type, the cast builds, skinning and animation live
 * in their own modules; this file keeps the public surface in one place.
 */
export type { CharacterRig, Swing } from "./character-rig";
export { buildCivilian, buildCorpo, buildFixer, buildGanger, buildHeroine, buildRipperdoc } from "./character-builds";
export {
  CROUCH_KNEE,
  CROUCH_LEAN,
  CROUCH_THIGH,
  type CrouchOffset,
  LANDING_DIP,
  type RigCombat,
  type RigMotion,
  animateRig,
  crouchOffset,
  deathFinished,
  jumpLegs,
  raiseWeapon,
  setWeaponDrawn,
  startDeath,
  startReload,
  startStagger,
  startSwing,
} from "./character-animation";
export { DRAW_SECONDS, SWING_STRIKE, meleePose, swingPhase } from "./character-poses";
