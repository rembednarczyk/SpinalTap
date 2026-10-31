import { useMemo } from "react";
import { useUi } from "../use-ui";
import { type Translate, type TranslateText, textTranslator, translator } from "./t";

/** The translator for the language in the settings; a change re-renders at once (ADR-0056). */
export const useT = (): Translate => {
  const locale = useUi((s) => s.settings.locale);
  return useMemo(() => translator(locale), [locale]);
};

/** Domain texts from core (item names, objectives, factions) in the language of the settings. */
export const useText = (): TranslateText => {
  const locale = useUi((s) => s.settings.locale);
  return useMemo(() => textTranslator(locale), [locale]);
};
