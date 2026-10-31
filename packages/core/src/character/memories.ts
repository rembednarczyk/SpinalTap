import type { StatModifiers } from "./stats";

/**
 * Recovered memories are Seki's diegetic progression: she "remembers" skills she had
 * before the accident. Each fragment carries its own stat modifiers.
 */
export interface MemoryFragment {
  readonly id: string;
  /** Catalog key of the title (`memory.<id>.title`, ADR-0056); `description` likewise. */
  readonly title: string;
  readonly description: string;
  readonly modifiers: StatModifiers;
}

export const MEMORY_CATALOG = {
  combat_reflex: {
    id: "combat_reflex",
    title: "memory.combat_reflex.title",
    description: "memory.combat_reflex.desc",
    modifiers: { critChance: 0.12, damageBonus: 3 },
  },
  street_runner: {
    id: "street_runner",
    title: "memory.street_runner.title",
    description: "memory.street_runner.desc",
    modifiers: { moveSpeed: 0.6 },
  },
  // Main thread, act I ("Echo"): fragments that surface through the Kagami module in Seki's skull.
  courier_case: {
    id: "courier_case",
    title: "memory.courier_case.title",
    description: "memory.courier_case.desc",
    modifiers: { armor: 2 },
  },
  operating_table: {
    id: "operating_table",
    title: "memory.operating_table.title",
    description: "memory.operating_table.desc",
    modifiers: { critMultiplier: 0.25 },
  },
  crash_night: {
    id: "crash_night",
    title: "memory.crash_night.title",
    description: "memory.crash_night.desc",
    modifiers: { moveSpeed: 0.4 },
  },
  // Main thread, act II ("Lustro", ADR-0023): Ren's chip, the voice behind his, Kagami's copy.
  rooftop: {
    id: "rooftop",
    title: "memory.rooftop.title",
    description: "memory.rooftop.desc",
    modifiers: { maxHp: 15 },
  },
  last_call: {
    id: "last_call",
    title: "memory.last_call.title",
    description: "memory.last_call.desc",
    modifiers: { aimStability: 0.1 },
  },
  mirror: {
    id: "mirror",
    title: "memory.mirror.title",
    description: "memory.mirror.desc",
    modifiers: { critChance: 0.05, damageBonus: 2 },
  },
} as const satisfies Record<string, MemoryFragment>;

export type MemoryId = keyof typeof MEMORY_CATALOG;

export const isMemoryId = (id: string): id is MemoryId => Object.hasOwn(MEMORY_CATALOG, id);
