import { type Locale, textRef } from "@seki/core";
import type { NarrativeText } from "@seki/narrative";
import { type MessageParams, translateText } from "@seki/ui";

/**
 * A text the simulation or the narrative names by key (ADR-0056: they hold keys, not sentences),
 * in `locale`. A thin wrapper over ui's one translator, `translateText`, for callers that hold a
 * bare key and its parameters rather than a `TextRef`. Anything that is not a catalog key (a
 * name, a test's own string) shows as it is.
 */
export const contentText = (locale: Locale, text: string, params?: MessageParams): string => translateText(locale, params ? textRef(text, params) : text);

/** How the narrative writes its keys: in the language `locale` gives at that moment (from the next line on). */
export const narrativeText =
  (locale: () => Locale): NarrativeText =>
  (key, params) =>
    contentText(locale(), key, params);
