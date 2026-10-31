import type { Locale } from "@seki/core";
import type { NarrativeText } from "./i18n/text";
import { EN } from "./i18n/en";
import { PL } from "./i18n/pl";

/**
 * The story in each language of the game (ADR-0056). Polish is the original and always there;
 * a language without a source of its own plays the Polish one.
 */
export type StorySources = { readonly pl: string } & { readonly [L in Locale]?: string };

/** The narrative's words outside ink (speakers, the fixers' contract notes) in `locale`. */
export const narrativeText = (locale: Locale): NarrativeText => (locale === "pl" ? PL : EN);
