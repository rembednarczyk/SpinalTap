import type { CastKey } from "@seki/core";
import { fnv1a } from "../rng/derive-random";

/**
 * Who plays whom (ADR-0076): the spawn key of a character placed by content (`ActorDef.spawn.key`,
 * the `npcKey` of a street scene) and the named character of the story it is. The renderer picks
 * the model by the name; spawn keys without one are the background, seen by `look` alone.
 */
export const CAST_OF_SPAWN: Readonly<Record<string, CastKey>> = {
  // Kaito's spawn key is his role: the fixer of Neon Koi.
  fixer: "kaito",
  mori: "mori",
  ume: "ume",
  hana: "hana",
  genzo: "genzo",
  ren: "ren",
  kurosawa: "kurosawa",
  fumiko: "fumiko",
  kenta: "kenta",
  goro: "goro",
  oyaji: "oyaji",
  sachiko: "sachiko",
  tetsu: "tetsu",
  hideo: "hideo",
  mei: "mei",
  // The street scenes' people (`EncounterDef.npcKey`).
  "enc-sabu": "sabu",
  "enc-hina": "hina",
  "enc-takumi": "takumi",
  "enc-shiro": "shiro",
  "enc-tomo": "tomo",
  "enc-nobu": "nobu",
  "enc-koji": "koji",
  "enc-daigo": "daigo",
  "enc-riko": "riko",
  "enc-kiku": "kiku",
  "enc-akane": "akane",
};

/**
 * The view fields that pick a character's model: its name, if it is one of the story, and the
 * seed of its look, a hash of `seed` (its spawn key, or a passer-by's chunk and index). Fixed by
 * the key, so a loaded game shows the same people; it is no state of the simulation.
 */
export const castViewOf = (key: string | undefined, seed: string): { readonly cast?: CastKey; readonly look: number } => {
  const cast = key ? CAST_OF_SPAWN[key] : undefined;
  return cast ? { cast, look: fnv1a(seed) } : { look: fnv1a(seed) };
};
