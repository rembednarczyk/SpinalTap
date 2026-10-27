import type { StatModifiers } from "./stats";

/**
 * Recovered memories are Seki's diegetic progression: she "remembers" skills she had
 * before the accident. Each fragment carries its own stat modifiers.
 */
export interface MemoryFragment {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly modifiers: StatModifiers;
}

export const MEMORY_CATALOG = {
  combat_reflex: {
    id: "combat_reflex",
    title: "Wspomnienie: odruch",
    description:
      "Strzał w zaułku obudził coś znajomego. Ręce wiedzą, gdzie celować, zanim zdążysz pomyśleć. Szansa na krytyk +12%.",
    modifiers: { critChance: 0.12, damageBonus: 3 },
  },
  street_runner: {
    id: "street_runner",
    title: "Wspomnienie: ucieczka",
    description: "Pamiętasz dachy i deszcz. Biegłaś wtedy przed kimś. Szybkość ruchu +0,6 m/s.",
    modifiers: { moveSpeed: 0.6 },
  },
  // Main thread, act I ("Echo"): fragments that surface through the Kagami module in Seki's skull.
  courier_case: {
    id: "courier_case",
    title: "Wspomnienie: walizka",
    description:
      "Rampa za magazynem, deszcz, walizka przykuta do nadgarstka. Ciało pamięta, jak przyjąć cios na ramię i iść dalej. Pancerz +2.",
    modifiers: { armor: 2 },
  },
  operating_table: {
    id: "operating_table",
    title: "Wspomnienie: stół",
    description:
      "Białe światło i głos, który liczy zapisy. Leżałaś tam tak długo, że znasz każde słabe miejsce w ciele. Obrażenia krytyczne +0,25.",
    modifiers: { critMultiplier: 0.25 },
  },
  crash_night: {
    id: "crash_night",
    title: "Wspomnienie: wrak",
    description: "Dron nad maską, mokry asfalt, kierownica w dłoniach. Wiesz już, jak wyszłaś z tego żywa. Szybkość ruchu +0,4 m/s.",
    modifiers: { moveSpeed: 0.4 },
  },
} as const satisfies Record<string, MemoryFragment>;

export type MemoryId = keyof typeof MEMORY_CATALOG;

export const isMemoryId = (id: string): id is MemoryId => Object.hasOwn(MEMORY_CATALOG, id);
