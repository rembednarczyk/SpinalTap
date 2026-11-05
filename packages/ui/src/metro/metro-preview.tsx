import { CityShapes, type CityIndex, windowAround } from "../hud/city-layer";
import { useT } from "../i18n/use-t";
import { formatNumber, useLocale } from "../i18n/number";
import type { MapMetroVm, MetroNearVm, MetroPreviewVm } from "../store/metro-vm";
import { NEAR_RADIUS } from "../store/metro-vm";
import { MetroLayer } from "./metro-layer";

/** Half the side of the card's close-up map, metres: the 150 m circle and a margin. */
const CLOSE_UP = NEAR_RADIUS + 20;

const NearDot = ({ n, i }: { n: MetroNearVm; i: number }) => (
  <g className={`metro__card-near metro__card-near--${n.kind}`} transform={`translate(${n.x.toFixed(1)} ${(-n.z).toFixed(1)})`}>
    <circle r={9} />
    <text fontSize={11}>{i + 1}</text>
  </g>
);

/** The close-up of the destination: the same city as the map tab, the 150 m circle, the line and what is near. */
const CloseUp = ({ p, city, metro }: { p: MetroPreviewVm; city: CityIndex | null; metro: MapMetroVm | null }) => {
  const box = windowAround(p.x, p.z, CLOSE_UP, 1);
  return (
    <svg className="metro__card-map" viewBox={`${p.x - CLOSE_UP} ${-p.z - CLOSE_UP} ${CLOSE_UP * 2} ${CLOSE_UP * 2}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-testid="metro-preview-map">
      {city && <CityShapes city={city} window={box} prefix="citymap" />}
      <circle className="metro__card-radius" cx={p.x} cy={-p.z} r={NEAR_RADIUS} />
      {metro && <MetroLayer metro={metro} k={0.8} route={p.route} selected={p.id} names={() => null} scope="metro-preview" />}
      {p.near.map((n, i) => (
        <NearDot key={`${n.label}-${i}`} n={n} i={i} />
      ))}
    </svg>
  );
};

/**
 * The card of the chosen destination (ADR-0071): its name, district and entrances, the ride (stops
 * on the way, fare, time), a close-up of the neighbourhood with up to four things within 150 m and,
 * while a contract is hot, that security watches the platform.
 */
export const MetroPreview = ({ p, via, fare, refusal, city, metro }: { p: MetroPreviewVm; via: readonly string[]; fare: string; refusal: string | null; city: CityIndex | null; metro: MapMetroVm | null }) => {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="metro__card" aria-label={p.name} data-testid="metro-preview">
      <header className="metro__card-head">
        <h3 className="metro__card-name">{p.name}</h3>
        <span className="metro__card-district">{p.district}</span>
      </header>
      <p className="metro__card-ride" data-testid="metro-route">
        {`${t("metro.stops", { count: p.stops })} · ${t("metro.time", { seconds: p.seconds })} · ${fare}`}
      </p>
      <p className="metro__hint" data-testid="metro-via">
        {via.length > 0 ? t("metro.via", { stations: via.join(", ") }) : t("metro.direct")}
      </p>
      <ul className="metro__card-list">
        {p.entrances.map((e) => (
          <li key={e.label}>{t("metro.entrance", { label: e.label, name: e.name })}</li>
        ))}
      </ul>
      <CloseUp p={p} city={city} metro={metro} />
      <h4 className="metro__planned-head">{t("metro.near.heading")}</h4>
      {p.near.length === 0 ? (
        <p className="metro__hint" data-testid="metro-near-none">
          {t("metro.near.none")}
        </p>
      ) : (
        <ol className="metro__card-list" data-testid="metro-near">
          {p.near.map((n, i) => (
            <li key={`${n.label}-${i}`} data-testid={`metro-near-${n.kind}`}>
              <span>{`${i + 1}. ${t(n.label, n.name !== undefined ? { name: n.name } : undefined)}`}</span>
              <b>{t("metro.near.distance", { distance: formatNumber(locale, n.distance) })}</b>
            </li>
          ))}
        </ol>
      )}
      {refusal && (
        <p className="metro__card-watch" data-testid="metro-preview-watched">
          {refusal}
        </p>
      )}
    </section>
  );
};
