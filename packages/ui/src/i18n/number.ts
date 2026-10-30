import type { Locale } from "@seki/core";
import { useUi } from "../use-ui";

/**
 * Numbers in the player's language (ADR-0056): `pl-PL` as the panels always wrote them (a comma
 * for decimals, a space between thousands from 10 000), `en-US` in English.
 */
const TAG: Readonly<Record<Locale, string>> = { en: "en-US", pl: "pl-PL" };

export const formatNumber = (locale: Locale, n: number, options?: Intl.NumberFormatOptions): string => n.toLocaleString(TAG[locale], options);

/** Sorts names as the language does. */
export const compareText = (locale: Locale, a: string, b: string): number => a.localeCompare(b, locale);

/** The language in the settings, for numbers and sorting. */
export const useLocale = (): Locale => useUi((s) => s.settings.locale);
