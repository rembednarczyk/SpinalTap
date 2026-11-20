import { useT } from "../i18n/use-t";
import type { CrimeMarkerVm } from "../store/ui-store";
import { useJournalIntents } from "../use-ui";

/*
 * The street's crimes on the maps (ADR-0091 stage 6), as the NCPD's blue icons of Cyberpunk 2077:
 * a blue badge with a bar of alarm; on the city map everywhere, a tap shows a card with the kind and
 * Tessen's pay (within 300 m) and following it; on the minimap only near or followed.
 */

/** The badge: a ring with an exclamation mark, the followed one with a second ring round it. */
export const CrimeIcon = ({ tracked }: { tracked: boolean }) => (
  <>
    {tracked && <circle className="crime__halo" r={4.6} />}
    <circle className="crime__badge" r={3} />
    <path className="crime__mark" d="M0 -1.7 V0.4 M0 1.3 V1.6" />
  </>
);

/** The crimes on the city map, `k` metres a unit of the icons; a tap picks one. */
export const CityCrimes = ({ crimes, k, onPick }: { crimes: readonly CrimeMarkerVm[]; k: number; onPick: (id: string) => void }) => {
  const t = useT();
  return (
    <>
      {crimes.map((c) => (
        <g
          key={c.id}
          className={`crime crime--city${c.tracked ? " crime--tracked" : ""}`}
          transform={`translate(${c.x.toFixed(1)} ${(-c.z).toFixed(1)}) scale(${(1.4 * k).toFixed(2)})`}
          onClick={() => onPick(c.id)}
          data-testid="citymap-crime"
        >
          <title>{c.near ? t(`crime.kind.${c.kind}`) : t("map.marker.crime")}</title>
          <CrimeIcon tracked={c.tracked} />
        </g>
      ))}
    </>
  );
};

/** The picked crime's card under the map: what and how much near, a hint far; following it. */
export const CrimeCard = ({ crime, onClose }: { crime: CrimeMarkerVm; onClose: () => void }) => {
  const t = useT();
  const { trackCrime } = useJournalIntents();
  return (
    <div className="crime-card" data-testid="crime-card">
      <div className="crime-card__title">{crime.near ? t(`crime.kind.${crime.kind}`) : t("map.marker.crime")}</div>
      <div className="crime-card__text">{crime.near && crime.reward !== null ? t("crime.reward", { eddies: crime.reward }) : t("crime.far")}</div>
      <div className="crime-card__actions">
        <button type="button" className="citymap__btn citymap__btn--wide" onClick={() => trackCrime(crime.tracked ? null : crime.id)} data-testid="crime-track">
          {crime.tracked ? t("crime.untrack") : t("crime.track")}
        </button>
        <button type="button" className="citymap__btn" onClick={onClose} aria-label={t("crime.close")}>
          ×
        </button>
      </div>
    </div>
  );
};
