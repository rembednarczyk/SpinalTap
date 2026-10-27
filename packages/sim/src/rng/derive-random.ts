import { SeededRandom } from "./seeded-random";

/** FNV-1a over the UTF-16 code units of `text`. */
const fnv1a = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/**
 * A random stream of its own for one purpose (ADR-0015: one per loot container), derived from
 * the game seed and a key. It never touches the main stream, so adding loot does not change a
 * fight, and the same enemy in the same game always drops the same bag, however many shots
 * were fired before. mulberry32 seeded with the seed mixed into the FNV-1a hash of the key.
 */
export const deriveRandom = (seed: number, key: string): SeededRandom => new SeededRandom((Math.imul(seed >>> 0, 0x9e3779b1) ^ fnv1a(key)) >>> 0);
