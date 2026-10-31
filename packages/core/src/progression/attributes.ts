/**
 * The five attributes (ADR-0059). Each runs from 3 to 15; a new character has 3 in every one and
 * the levels 2..30 give 29 points, so no build maxes them all. Their effects come in stage 2; the
 * names the player reads are keys of the UI catalogs (ADR-0056), not text here.
 */
export const ATTRIBUTE_IDS = ["might", "reflex", "tech", "net", "shadow"] as const;

export type AttributeId = (typeof ATTRIBUTE_IDS)[number];

export const ATTRIBUTE_START = 3;
export const ATTRIBUTE_MAX = 15;

export type Attributes = Readonly<Record<AttributeId, number>>;

export const START_ATTRIBUTES: Attributes = { might: ATTRIBUTE_START, reflex: ATTRIBUTE_START, tech: ATTRIBUTE_START, net: ATTRIBUTE_START, shadow: ATTRIBUTE_START };

export const isAttributeId = (v: unknown): v is AttributeId => typeof v === "string" && (ATTRIBUTE_IDS as readonly string[]).includes(v);
