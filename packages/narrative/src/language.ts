import type { Locale } from "@seki/core";

/**
 * The story in each language of the game (ADR-0056). Polish is the original and always there;
 * a language without a source of its own plays the Polish one.
 */
export type StorySources = { readonly pl: string } & { readonly [L in Locale]?: string };
