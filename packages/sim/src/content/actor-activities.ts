import type { ActivityPlan } from "../world/activity-types";

/**
 * What the characters without a daily plan do where they stand (ADR-0040), by key. The ones
 * with a plan take theirs from its stops (schedules.ts). A cycle changes every few game minutes,
 * counted from midnight, so it is a pure function of the clock.
 */
export const ACTOR_ACTIVITIES: Readonly<Record<string, ActivityPlan>> = {
  // Doktor Mori works at the clinic's terminal.
  mori: "terminal",
  // Tetsu tinkers at the DENKI table, and talks shop between repairs.
  tetsu: { cycle: ["terminal", "terminal", "talk"], minutes: 20 },
  // Sachiko minds the kiosk at the market gate.
  sachiko: { cycle: ["phone", "sweep"], minutes: 25 },
  // The north row's keepers cook and clean up between orders.
  kenta: { cycle: ["cook", "cook", "sweep"], minutes: 15 },
  goro: { cycle: ["sweep", "phone"], minutes: 30 },
  // Hana talks deals over her handcart.
  hana: { cycle: ["talk", "phone"], minutes: 30 },
  // Genzō keeps his phone at his ear, and smokes between calls.
  genzo: { cycle: ["phone", "smoke"], minutes: 20 },
  // The docker on his smoke break by the fence.
  doker: "smoke",
  // Ren sleeps rough on the roof.
  ren: "sleep",
  kurosawa: "smoke",
};
