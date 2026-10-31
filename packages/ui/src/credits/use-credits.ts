import { useMemo } from "react";
import type { MessageKey } from "../i18n/en";
import { useT } from "../i18n/use-t";
import { CREDITS, CREDIT_SECTIONS, type Credit, type CreditSection, LICENSES } from "./credits";

/** One line of the credits: the work, its author and licence, as the screen shows them. */
export interface CreditRow {
  readonly id: string;
  readonly title: string;
  /** "by Kenney" in the player's language; the name itself as written. */
  readonly byline: string;
  readonly authorUrl: string | null;
  readonly url: string;
  readonly license: string;
  readonly licenseUrl: string | null;
  /** "changed for the game", or null. */
  readonly changed: string | null;
}

export interface CreditGroup {
  readonly section: CreditSection;
  readonly heading: string;
  readonly rows: readonly CreditRow[];
}

const HEADINGS: Readonly<Record<CreditSection, MessageKey>> = {
  street: "credits.section.street",
  city: "credits.section.city",
  characters: "credits.section.characters",
  weapons: "credits.section.weapons",
  audio: "credits.section.audio",
};

/** The credits grouped by section, in the screen's order, translated (ADR-0056, ADR-0063). */
export const useCredits = (credits: readonly Credit[] = CREDITS): readonly CreditGroup[] => {
  const t = useT();
  return useMemo(
    () =>
      CREDIT_SECTIONS.map((section) => ({
        section,
        heading: t(HEADINGS[section]),
        rows: credits
          .filter((c) => c.section === section)
          .map((c): CreditRow => {
            const license = LICENSES[c.license];
            return {
              id: c.id,
              title: c.title,
              byline: t("credits.by", { author: c.author }),
              authorUrl: c.authorUrl ?? null,
              url: c.url,
              license: license.name,
              licenseUrl: license.url ?? null,
              changed: c.changed ? t("credits.changed") : null,
            };
          }),
      })).filter((g) => g.rows.length > 0),
    [t, credits],
  );
};
