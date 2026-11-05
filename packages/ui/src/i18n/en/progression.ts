import type { Message } from "../message";

/**
 * English texts of the attributes (ADR-0059, stage 2): their names, what a point does, and the
 * sheet's section to spend the points in. The full Progress tab comes in stage 7.
 */
export const enProgression = {
  "attribute.section": "Attributes",
  "attribute.level": "Level {level}",
  "attribute.points": { one: "{count} point to spend", other: "{count} points to spend" },
  "attribute.raise": "Raise {name}",
  "attribute.might.name": "Might",
  "attribute.might.effect": "+4 health and +2% melee damage per point",
  "attribute.reflex.name": "Reflex",
  "attribute.reflex.effect": "+1% aim stability per point, quicker to aim down sights",
  "attribute.tech.name": "Tech",
  "attribute.tech.effect": "+1 armor from clothes per point, +1 cyberware capacity per 3 points",
  "attribute.net.name": "Net",
  "attribute.net.effect": "+1 RAM per 2 points, faster uploads",
  "attribute.shadow.name": "Shadow",
  "attribute.shadow.effect": "Spotted 2% slower and +0.5% crit chance per point",
} as const satisfies Readonly<Record<string, Message>>;

export type ProgressionKey = keyof typeof enProgression;
