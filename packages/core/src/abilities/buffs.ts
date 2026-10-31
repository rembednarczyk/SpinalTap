import type { StatModifiers } from "../character/stats";
import type { BuffId } from "../world/wave2";

/**
 * Short timed effects from food, drinks and stims (ADR-0033). The domain keeps what runs and
 * the seconds left; the simulation ticks them, heals with `regen`, speeds the cooldowns up with
 * `quick_cooldown` and steadies the aim with `steady`. Numbers are tuned so a buff is felt in a
 * fight and never replaces medical kit (core/test/wave2-balance.test.ts).
 */
export interface BuffDefinition {
  readonly id: BuffId;
  /** Catalog key of the name (`buff.<id>.name`, ADR-0056). */
  readonly name: string;
  /** Seconds a fresh dose lasts. Eating again refreshes it, it never stacks. */
  readonly duration: number;
  /** HP restored per second. */
  readonly regen?: number;
  /** Cooldowns (the active ability, the dash) run this many times faster. */
  readonly cooldownRate?: number;
  readonly modifiers?: StatModifiers;
}

export const BUFF_CATALOG: Readonly<Record<BuffId, BuffDefinition>> = {
  regen: { id: "regen", name: "buff.regen.name", duration: 120, regen: 0.5 },
  quick_cooldown: { id: "quick_cooldown", name: "buff.quick_cooldown.name", duration: 90, cooldownRate: 1.5 },
  steady: { id: "steady", name: "buff.steady.name", duration: 60, modifiers: { aimStability: 0.2 } },
};

/** Stable order of the buffs (state, events, HUD). */
export const BUFF_IDS: readonly BuffId[] = ["regen", "quick_cooldown", "steady"];

export const isBuffId = (v: unknown): v is BuffId => typeof v === "string" && (BUFF_IDS as readonly string[]).includes(v);

export interface ActiveBuff {
  readonly id: BuffId;
  /** Seconds left. */
  readonly left: number;
}

export type BuffList = readonly ActiveBuff[];

export const NO_BUFFS: BuffList = [];

const ordered = (list: readonly ActiveBuff[]): ActiveBuff[] => [...list].sort((a, b) => BUFF_IDS.indexOf(a.id) - BUFF_IDS.indexOf(b.id));

/** Starts the buff, or refreshes it to a full dose (the longer of what is left and a new one). */
export const applyBuff = (list: BuffList, id: BuffId, seconds: number = BUFF_CATALOG[id].duration): BuffList => {
  const running = list.find((b) => b.id === id);
  if (!running) return ordered([...list, { id, left: seconds }]);
  return list.map((b) => (b.id === id ? { id, left: Math.max(b.left, seconds) } : b));
};

export interface BuffTick {
  readonly buffs: BuffList;
  readonly ended: readonly BuffId[];
  /** Whole HP the regeneration restores this step. */
  readonly heal: number;
}

/**
 * Whole HP a regeneration of `rate` HP/s gives while its time left runs from `left` down by
 * `dt`: counted on whole points of the time left, so steps of any size add up to the same HP
 * and health stays an integer.
 */
export const regenBetween = (rate: number, left: number, dt: number): number => Math.ceil(left * rate - 1e-9) - Math.ceil((left - dt) * rate - 1e-9);

/** Runs the buffs for `dt` seconds: what is left, what ended, and the HP regeneration restores. */
export const tickBuffs = (list: BuffList, dt: number): BuffTick => {
  if (list.length === 0) return { buffs: list, ended: [], heal: 0 };
  const buffs: ActiveBuff[] = [];
  const ended: BuffId[] = [];
  let heal = 0;
  for (const b of list) {
    const def = BUFF_CATALOG[b.id];
    const step = Math.min(dt, b.left);
    if (def.regen) heal += regenBetween(def.regen, b.left, step);
    const left = b.left - dt;
    if (left > 1e-9) buffs.push({ id: b.id, left });
    else ended.push(b.id);
  }
  return { buffs, ended, heal };
};

export const hasBuff = (list: BuffList, id: BuffId): boolean => list.some((b) => b.id === id);

/** How fast cooldowns run with these buffs (1 without). */
export const cooldownRateOf = (list: BuffList): number => list.reduce((rate, b) => Math.max(rate, BUFF_CATALOG[b.id].cooldownRate ?? 1), 1);

/** Stat modifiers of the running buffs, in buff order. */
export const buffModifiers = (list: BuffList): StatModifiers[] => {
  const out: StatModifiers[] = [];
  for (const b of list) {
    const m = BUFF_CATALOG[b.id].modifiers;
    if (m) out.push(m);
  }
  return out;
};
