import type { Locale } from "@seki/core";
import type { NarrativeText } from "@seki/narrative";
import { type MessageParams, isMessageKey, translate } from "@seki/ui";

/**
 * A text the simulation or the narrative names by key (ADR-0056: they hold keys, not sentences),
 * in `locale`. Anything that is not a catalog key (a name, a test's own string) shows as it is.
 */
export const contentText = (locale: Locale, text: string, params?: MessageParams): string => (isMessageKey(text) ? translate(locale, text, params) : text);

/** How the narrative writes its keys: in the language `locale` gives at that moment (from the next line on). */
export const narrativeText =
  (locale: () => Locale): NarrativeText =>
  (key, params) =>
    contentText(locale(), key, params);
