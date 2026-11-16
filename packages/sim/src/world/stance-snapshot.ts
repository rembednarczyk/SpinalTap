import type { EntitySnapshot, MeleeSnapshot, StanceSnapshot, Vec3 } from "@seki/core";
import type { Entity, MeleeState } from "./components";

/*
 * What a fight leaves between two steps (G-883, v41): velocities, blows in progress and the
 * player's posture, gun, time in the air and dash. A game saved mid-fight goes on as the one
 * saved from; at rest nothing of it is saved, so a calm save is as before.
 */

const moving = (v: Vec3 | undefined): v is Vec3 => !!v && (v.x !== 0 || v.y !== 0 || v.z !== 0);

const meleeAtRest = (m: MeleeState): boolean =>
  m.phase === "idle" && m.timer === 0 && m.combo === 0 && !m.queued && m.stagger === 0 && !m.guard && m.parry === 0 && m.parryCooldown === 0 && m.knock.time === 0;

const meleeSnapshotOf = (m: MeleeState): MeleeSnapshot => ({
  phase: m.phase,
  timer: m.timer,
  strike: m.strike,
  combo: m.combo,
  queued: m.queued,
  stagger: m.stagger,
  stunned: !!m.stunned,
  guard: m.guard,
  parry: m.parry,
  parryCooldown: m.parryCooldown,
  knock: { ...m.knock },
});

/** The player's stance, or null for anyone else. */
const stanceOf = (e: Entity): StanceSnapshot | null => {
  const { posture: p, combatant: c } = e;
  if (!e.player || !p || !c) return null;
  const s: StanceSnapshot = {
    crouched: p.crouched,
    crouch: p.amount,
    sprinting: p.sprinting,
    aiming: p.aiming,
    aim: p.aim,
    holstered: c.holstered,
    reloading: c.reloading,
    drawing: c.drawing,
    bloom: c.bloom,
    ...(e.fall !== undefined ? { fall: e.fall } : {}),
    ...(e.airPeak !== undefined ? { airPeak: e.airPeak } : {}),
    ...(e.landing !== undefined ? { landing: e.landing } : {}),
    ...(e.jump ? { jump: { ...e.jump } } : {}),
  };
  return e.perks ? { ...s, perks: { ...e.perks, dashDir: { ...e.perks.dashDir } } } : s;
};

/** `s` with the velocity, the melee and the stance of `e`, those not at rest. */
export const withMotion = (e: Entity, s: EntitySnapshot): EntitySnapshot => {
  const v = moving(e.velocity) ? { ...s, velocity: { ...e.velocity } } : s;
  const m = e.melee && !meleeAtRest(e.melee) ? { ...v, melee: meleeSnapshotOf(e.melee) } : v;
  const stance = stanceOf(e);
  return stance ? { ...m, stance } : m;
};

/** Puts the saved velocity, melee and stance back onto a freshly built entity. */
export const applyMotion = (e: Entity, s: EntitySnapshot): void => {
  if (e.velocity && s.velocity) e.velocity = { ...s.velocity };
  if (e.melee && s.melee) e.melee = { ...s.melee, knock: { ...s.melee.knock } };
  const st = s.stance;
  if (!e.player || !st) return;
  if (e.posture) Object.assign(e.posture, { crouched: st.crouched, amount: st.crouch, prevAmount: st.crouch, sprinting: st.sprinting, aiming: st.aiming, aim: st.aim, prevAim: st.aim });
  // Her magazine is the domain's; the save keeps what the gun is doing with it.
  if (e.combatant) Object.assign(e.combatant, { holstered: st.holstered, reloading: st.reloading, drawing: st.drawing, bloom: st.bloom });
  if (st.fall !== undefined) e.fall = st.fall;
  if (st.airPeak !== undefined) e.airPeak = st.airPeak;
  if (st.landing !== undefined) e.landing = st.landing;
  if (st.jump) e.jump = { ...st.jump };
  if (st.perks) e.perks = { ...st.perks, dashDir: { ...st.perks.dashDir } };
};
