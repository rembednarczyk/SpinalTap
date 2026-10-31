import { useT } from "../i18n/use-t";
import { type CreditRow, useCredits } from "./use-credits";

/** What the credits screen asks of the menu that opened it. */
export interface CreditsIntents {
  closeCredits(): void;
}

/** A link out of the game, in a new tab. */
const Out = ({ href, children }: { href: string | null; children: string }) =>
  href ? (
    <a className="credits__link" href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ) : (
    <>{children}</>
  );

/** The work (linked to where it comes from), its author, its licence, and whether it was changed. */
const Row = ({ row }: { row: CreditRow }) => (
  <li className="credits__row" data-credit={row.id}>
    <Out href={row.url}>{row.title}</Out> <Out href={row.authorUrl}>{row.byline}</Out>
    {" · "}
    <Out href={row.licenseUrl}>{row.license}</Out>
    {row.changed ? ` · ${row.changed}` : ""}
  </li>
);

/**
 * Who made what the game is drawn from (ADR-0045, ADR-0063): the map and the terrain, then every
 * model and sound with its author and licence, from the one list in `credits.ts`. Opened from the
 * title screen and the pause menu.
 */
export const CreditsScreen = ({ intents }: { intents: CreditsIntents }) => {
  const t = useT();
  const groups = useCredits();
  return (
    <div className="menu credits" data-testid="credits">
      <h2 className="credits__title">{t("credits.heading")}</h2>
      <div className="credits__body">
        <p className="credits__line">{t("credits.game")}</p>
        <p className="credits__line">{t("credits.osm")}</p>
        <p className="credits__line">{t("credits.terrain")}</p>
        <h3 className="credits__section">{t("credits.assets")}</h3>
        {groups.map((g) => (
          <section key={g.section} data-testid={`credits-${g.section}`}>
            <h4 className="credits__group">{g.heading}</h4>
            <ul className="credits__list">
              {g.rows.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </ul>
          </section>
        ))}
        <p className="credits__line">{t("credits.fiction")}</p>
      </div>
      <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.closeCredits()}>
        {t("menu.back")}
      </button>
    </div>
  );
};
