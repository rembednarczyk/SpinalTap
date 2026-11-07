/**
 * The named characters of the story (ADR-0076), as the view knows them: the renderer picks the
 * model of a character by its key instead of by its role. The list follows the people of the ink
 * who stand in the world; which spawn key plays whom is the simulation's content (`sim`).
 */
export const CAST_KEYS = [
  // The leads and the vendors of the dialogues.
  "kaito",
  "mori",
  "ume",
  "hana",
  "genzo",
  "ren",
  "kurosawa",
  "fumiko",
  "kenta",
  "goro",
  "oyaji",
  "sachiko",
  // The second plan: a few lines each, every one with a look of its own (decision 6 of ADR-0076).
  "tetsu",
  "hideo",
  "mei",
  "sabu",
  "hina",
  "takumi",
  "shiro",
  "tomo",
  "nobu",
  "koji",
  "daigo",
  "riko",
  "kiku",
  "akane",
  // The people of the places and the jobs (ADR-0076 stage 2): Neon Koi's barman and two
  // regulars, the salaryman and the Tessen guard with the gull of the street scenes, and Mika,
  // the defector of the escort job.
  "barman",
  "koi-regular-1",
  "koi-regular-2",
  "salaryman",
  "gull-guard",
  "mika",
] as const;

export type CastKey = (typeof CAST_KEYS)[number];

export const isCastKey = (key: string): key is CastKey => (CAST_KEYS as readonly string[]).includes(key);
