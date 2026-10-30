/**
 * The game's languages (ADR-0056). A player setting, not world state: the simulation never reads
 * it, and the presentation (app, ui) turns keys into text in the chosen language.
 */
export type Locale = "en" | "pl";

/** Every language the game ships, in the order the options list them. */
export const LOCALES: readonly Locale[] = ["en", "pl"];

/** English unless the player picks another language in the options. */
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "pl";
