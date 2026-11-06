import type { IconDrawing } from "./icon-drawing";

/**
 * Item icons after game-icons.net (ADR-0073 stage 2, decision of 6.11): implants and consumables,
 * from the icons of Lorc and Delapouite under CC BY 3.0 (ADR-0063). Changed for the game: the
 * 512 px silhouettes scaled onto the 32 x 32 grid of our own icons (3..29), curves flattened and
 * simplified to straight lines on a 0.5 grid, small details dropped, one `currentColor` outline
 * with the faint fill of `item-icon.css` instead of the white fill, so they share the neon line
 * and the rarity colour of the rest. Credited on the "Credits" screen (`credits.ts`) and in
 * `README.md` here; `tools/assets/sources.json` holds the source files and their sha256. Data
 * table: the size budget in `item-icons.test.tsx` counts these strings too.
 */
export type GameIconKey = "optics" | "subdermal" | "synapse" | "overclock" | "grip" | "tendons" | "reflex" | "medkit" | "bandage" | "ramen" | "skewer" | "coffee" | "stim" | "shard";

export type GameIconAuthor = "Lorc" | "Delapouite";

/** Where each drawing comes from: its author and its name on game-icons.net. */
export const GAME_ICON_SOURCES: Readonly<Record<GameIconKey, { readonly author: GameIconAuthor; readonly name: string }>> = {
  optics: { author: "Delapouite", name: "eye-target" },
  subdermal: { author: "Lorc", name: "layered-armor" },
  synapse: { author: "Lorc", name: "brain" },
  overclock: { author: "Lorc", name: "sands-of-time" },
  grip: { author: "Delapouite", name: "robot-grab" },
  tendons: { author: "Delapouite", name: "robot-leg" },
  reflex: { author: "Delapouite", name: "swallow" },
  medkit: { author: "Delapouite", name: "first-aid-kit" },
  bandage: { author: "Lorc", name: "bandage-roll" },
  ramen: { author: "Delapouite", name: "noodles" },
  skewer: { author: "Lorc", name: "meat" },
  coffee: { author: "Delapouite", name: "coffee-cup" },
  stim: { author: "Lorc", name: "syringe" },
  shard: { author: "Lorc", name: "crystal-growth" },
};

export const GAME_ICON_PATHS: Readonly<Record<GameIconKey, IconDrawing>> = {
  optics: {
    body: [
      "M16 8.5l-6.5 2-5.5 5.5 5.5 5.5 6.5 2 6.5-2 5.5-5.5-5.5-5.5z",
      "M16 9.5l3 1-1.5 2-2-1.5 0 1.5-2 1-2.5 3 1.5 0 1 2 3 2.5 0-1.5 2-1 1-2 1.5 0 0-1-1.5-.5 2.5-1 .5 2-2 4.5-4.5 2-4.5-2-2-4.5 2-4.5z",
      "M15.5 13l0 1.5 1.5-1 2 2-1.5 0 1 1.5-2 2 0-1.5-1.5 1-2-2 1.5 0-1-1.5z",
    ],
  },
  subdermal: {
    body: [
      "M9.5 4l-4.5 3 .5 4 9.5-6z",
      "M22.5 4l-6.5 .5 10.5 6.5 .5-4z",
      "M16 5.5l-10 6.5 1.5 4 12.5-8z",
      "M20.5 8.5l-3.5 2.5 7.5 5 1.5-4z",
      "M16 11.5l-8 5.5 2 3.5 10-6.5z",
      "M21 14.5l-4 3 5 3 2-3.5z",
      "M16 18l-5.5 3.5 2.5 3 6.5-4.5z",
      "M20.5 20.5l-3.5 2.5 2.5 1.5 2-3z",
      "M16 23.5l-2.5 1.5 2.5 3 2.5-2.5z",
    ],
  },
  synapse: {
    body: [
      "M15 6l-1 1 2 1.5-2.5 0-.5-2.5-6 2.5 2 3-3.5-1-.5 2.5 2 .5 4-2-1-3.5 2.5 2-3 4-5.5-1 2 6.5 2.5-3.5-1.5 3 2 2 5-1.5-1.5-1.5-1.5 1.5 1-2.5 3 2 3-1 2-3-2-3 2.5 2.5-.5 3 2.5 0 2-3-1 3 3.5-.5 0-5.5-1-1.5-2 2-2.5 0 0-3 1 2.5 2.5-2-5-3-.5 3-4 2.5 1.5 4-1.5-.5-1-4.5 5-3.5z",
      "M20.5 18.5l-9 3.5-5.5-1.5 3.5 3 6-1.5-3 5.5z",
    ],
  },
  overclock: {
    body: [
      "M9 4l1 7.5 3.5 4.5-3.5 4.5-1 7.5 14.5 0-1.5-7.5-3.5-4.5 3.5-4.5 1.5-7.5z",
      "M10 5l12.5 0-1.5 6.5-3.5 4 3.5 5 1.5 6.5-12.5 0 1-6.5 3.5-4-3.5-5z",
      "M20.5 9.5l-4.5 1-4.5-1 4.5 6z",
      "M16 22l-3.5 4 7.5 0z",
    ],
  },
  grip: {
    body: [
      "M18.5 5.5l-5 2-.5 6 1.5-1 .5-4 5.5-1 .5-1.5z",
      "M26 11l-1.5 .5-1 5.5-4 .5-1 1.5 4 .5 2.5-1.5z",
      "M16 13l-2 1-1 2 1 2.5 2 .5 2-.5 1-2.5-1-2z",
      "M16 14l2 2-2 2-2-2z",
      "M16 15l-1 1 1 1 1-1z",
      "M12 16l-3 3 4 4 3-3-3-1z",
      "M6 19l.5 2 4.5 4.5 2 .5-.5-2.5z",
      "M4 21l.5 2.5 4 4 2.5 .5-.5-2-4.5-4.5z",
      "M4 24l0 3.5 1.5-1.5z",
      "M6 26.5l-1.5 1.5 3.5 0z",
    ],
  },
  tendons: {
    body: [
      "M5.5 4l2 3 2.5-1-1.5-2z",
      "M9.5 4l2.5 2.5 4-.5 4.5 2.5-4-4.5z",
      "M14.5 7l-2 .5 4.5 4.5 4-2.5z",
      "M11.5 7.5l-2 1.5 5.5 4.5 1.5-1z",
      "M21.5 10l-5 3.5 5.5 1z",
      "M15.5 14.5l-3 6 4-5 2.5 1.5-7 5 1 1.5 8.5-8-3 .5z",
      "M11.5 23.5l-4 2-1 2 3.5 0z",
      "M14.5 24l-3.5 3.5 6.5 0z",
      "M17.5 25.5l.5 2 5.5 0 0-1.5z",
    ],
  },
  reflex: { body: ["M8 4l6.5 4 2 3 0 1-3.5 2.5-8 2 5 1.5-1 2-2.5 2.5 8.5-4.5 4-1 2.5 2 .5 2 .5 7 3.5-9 0-3-1.5-2 2.5-2.5-4.5-1-1-2.5-3-1.5z"] },
  medkit: {
    body: [
      "M16 6.5l-5 1-1 3 1.5 0 1.5-2 3-.5 3 .5 1.5 2 1.5 0-1-3z",
      "M9 11.5l0 1 3.5 0 0-1z",
      "M19.5 11.5l0 1 3.5 0 0-1z",
      "M7 13l-1.5 1-1 1.5 0 10.5 .5 1.5 21 0 1.5-.5 0-11-1-2.5z",
      "M14.5 16l3 0 0 3 3.5 0 0 3.5-3.5 0 0 3.5-3 0 0-3.5-3.5 0 0-3.5 3.5 0z",
    ],
  },
  bandage: {
    body: [
      "M9.5 4l-2.5 2-1 5 0 6 2 4.5 1 1 5.5 0-2-11.5-1.5-3.5-1-.5-1 1.5-1 5.5 .5 3.5 1 1 1-4-.5-1.5-.5 2-.5-2 1-1.5 1 0 .5 2.5-.5 4-2 1.5-1.5-3 0-7.5 1.5-2 1.5-1 3 4 1 9.5 2.5 6 2.5 2.5 1-1.5-1-1 1 0 1.5 2 1-1-1.5-1.5 4.5 1.5 .5-.5-2-1.5 3 0 0-1-2.5-.5-2.5-3-1-10.5-1.5-4-2-1.5z",
    ],
  },
  ramen: {
    body: [
      "M4 4.5l0 .5 18.5 3.5 0-1z",
      "M4 7.5l0 .5 18.5 2 0-1z",
      "M14.5 10l-1.5 4 1.5 2.5-.5 1.5 1 0 0-1.5-1.5-2.5 1.5-4z",
      "M16.5 10l-1.5 4 1.5 2.5-.5 1.5 1 0 0-1.5-1.5-2.5 1.5-3.5z",
      "M18.5 10.5l-1.5 3.5 1.5 2.5-.5 1.5 1 0 0-1.5-1.5-2.5 1.5-3.5z",
      "M5 19l1 3.5 2 2 4 1.5 4 0 4 0 4-1.5 2-2 1-3.5z",
      "M13 27l0 1 6 0 0-1z",
    ],
  },
  skewer: {
    body: [
      "M25.5 8l-5 4.5 1 2 7-1.5-.5-1.5-2-.5 1-1.5z",
      "M19 8.5l-10.5 6 1 6 4.5 3.5 1.5 0 9-6 0-3-1 0-.5 3.5-3.5-3.5-1.5-5 1.5-.5 2 2 .5-1z",
      "M19 10l-.5 1.5 1 2.5 1.5 2.5 2 1 .5-1-1.5 0-2-2.5-1-2.5 1.5-1z",
      "M8 19.5l-4 1 1 2 2 0-1 1.5 1 1.5 3-3z",
    ],
  },
  coffee: {
    body: [
      "M10.5 4.5l-2.5 3 2.5 3-1 1.5 2.5-2.5-2.5-2.5z",
      "M14.5 4.5l-2.5 3 2.5 3-1 1.5 2.5-2.5-2.5-2.5z",
      "M18.5 4.5l-2.5 3 2.5 3-1 1.5 2.5-2.5-2.5-2.5z",
      "M6.5 13l1.5 7.5 2.5 5 7.5 0 3-5 1-7.5z",
      "M23 13l0 2 2 1 .5 2-1.5 2-2 .5-.5 1.5 .5 0 3-1 2-2.5-1-3.5z",
      "M5 26l1 1.5 16.5 0 1-1.5z",
    ],
  },
  stim: {
    body: [
      "M8.5 4l-4.5 5 2.5-.5 4 3.5 1.5-1-4-4z",
      "M17 7.5l-9 8 .5 4 3 0 1.5-2.5 5 5 .5-.5-6-6.5 1-1 5 4.5 .5-.5-4-5.5 6.5 6.5 .5-1-5-5 3-2.5z",
      "M17 8.5l2 2-2 2-2-2z",
      "M10 15l2 2-2 2-1.5-2z",
      "M23.5 18.5l-2 1.5-2-.5 1 1.5-2 2 0 1.5 6-4.5z",
      "M23 22.5l-.5 1 5 4.5 .5-.5z",
    ],
  },
  shard: {
    body: [
      "M16 4l-4 4 0 3 2.5 2 1.5 9 1.5-13 .5 0 0 9 1-3.5 .5-6.5z",
      "M23 6.5l-2.5 2.5 0 2.5 .5-1.5 1.5-.5z",
      "M26 9l-4.5 2-5 13 .5 4 8-15 1 .5-7.5 14.5 1.5 0 7.5-14.5z",
      "M8.5 10l-2.5 5 3.5 13 4.5 0-2.5-14 1 0 2.5 14 1 0-2.5-14.5z",
      "M27 23l-3.5 0-2.5 5 3.5-2z",
      "M5 21.5l2 6.5 1.5 0-1.5-5z",
    ],
  },
};
