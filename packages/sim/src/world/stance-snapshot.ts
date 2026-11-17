import type { EntitySnapshot, LadderSettleSnapshot, MeleeSnapshot, StanceSnapshot, Vec3 } from "@seki/core";
import type { Entity, LadderSettle, MeleeState } from "./components";

/*
 * What a fight leaves between two steps (G-883, v41): velocities, blows in progress and the
 * player's posture, gun, time in the air and dash, and her step onto a ladder's rungs (G-913,
 * v44). A game saved mid-fight goes on as the one saved from; at rest nothing of it is saved, so
 * a calm save is as before.
 */

const moving = (v: Vec3 | undefined): v is Vec3 => !!v && (v.x !== 0 || v.y !== 0 || v.z !== 0);

// The last strike counts at rest too: an NPC's next swing is the other one of the two.
const meleeAtRest = (m: MeleeState): boolean =>
  m.phase === "idle" && m.timer === 0 && m.strike === 0 && m.combo === 0 && !m.queued && m.stagger === 0 && !m.guard && m.parry === 0 && m.parryCooldown === 0 && m.knock.time === 0;

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
  // A spent knock keeps its push on the component (nothing reads it at time 0): saved as none.
  knock: m.knock.time === 0 ? { x: 0, z: 0, time: 0 } : { ...m.knock },
});

// Field by field: the save's order, whichever way the step onto the rungs was made.
const ladderSettleOf = (ladder: string, s: LadderSettle): LadderSettleSnapshot => ({
  ladder,
  from: { ...s.from },
  fromYaw: s.fromYaw,
  y: s.y,
  over: s.over,
  duration: s.duration,
  t: s.t,
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
    ...(e.climb?.settle ? { ladderSettle: ladderSettleOf(e.climb.ladder, e.climb.settle) } : {}),
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
  // The step onto the rungs goes on (G-913); a climb without it is taken up by the ladder system.
  const ls = st.ladderSettle;
  if (ls) e.climb = { ladder: ls.ladder, speed: 0, settle: { from: { ...ls.from }, fromYaw: ls.fromYaw, y: ls.y, over: ls.over, duration: ls.duration, t: ls.t } };
};
