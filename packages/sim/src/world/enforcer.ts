import type { EntityId, FactionId } from "@seki/core";

/* Enforcers (ADR-0033): who sees through disguises. Kept free of world imports, so the factory can use it. */

/** FNV-1a of a string, for a fixed choice from a key. */
const hashOf = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};

/**
 * Does this enemy see through disguises? In a contract crew (keys `<contract>-g<n>`) the
 * Tessen shift boss is the first post (the office guard over the room) and every third Hebi
 * from the first is an enforcer. Anyone else: every third Hebi by its key (its id when it has
 * none), never a Tessen guard. Fixed by the key, so a loaded game marks the same people.
 */
export const isEnforcer = (key: string, id: EntityId, faction: FactionId): boolean => {
  if (faction !== "hebi" && faction !== "tessen") return false;
  const post = /-g(\d+)$/.exec(key);
  if (post) {
    const n = Number(post[1]);
    return faction === "tessen" ? n === 0 : n % 3 === 0;
  }
  return faction === "hebi" && hashOf(key || `#${id}`) % 3 === 0;
};
