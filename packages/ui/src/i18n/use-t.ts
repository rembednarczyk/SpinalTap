import { useMemo } from "react";
import { useUi } from "../use-ui";
import { type Translate, translator } from "./t";

/** The translator for the language in the settings; a change re-renders at once (ADR-0056). */
export const useT = (): Translate => {
  const locale = useUi((s) => s.settings.locale);
  return useMemo(() => translator(locale), [locale]);
};
