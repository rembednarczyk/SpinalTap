import { useMemo } from "react";
import type { Locale, MetroStationId } from "@seki/core";
import { CityShapes, type CityIndex, indexCity } from "../hud/city-layer";
import { useT } from "../i18n/use-t";
import { formatNumber } from "../i18n/number";
import type { MapMetroVm, MetroMapVm, MetroStopVm } from "../store/metro-vm";
import { useMetroIntents, useUi } from "../use-ui";
import { MetroLayer, type NamePlace } from "./metro-layer";
import { MetroPreview } from "./metro-preview";
import { useMetroKioskKeys } from "./use-metro-kiosk";

/** Amounts as the language writes them: Polish as before, English as en-GB. */
const amount = (locale: Locale, n: number) => n.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB");
export const eur = (locale: Locale, n: number) => `${amount(locale, n)} €$`;

/** The view of the kiosk's map: every station and possible station, with a margin. */
const fit = (metro: MapMetroVm): { box: string; k: number } => {
  const xs = [...metro.stations.map((s) => s.x), ...metro.planned.map((p) => p.x)];
  const zs = [...metro.stations.map((s) => s.z), ...metro.planned.map((p) => p.z)];
  // Wider than high: the names of the possible stations run sideways from their rings.
  const minX = Math.min(...xs) - 640;
  const maxX = Math.max(...xs) + 260;
  const minZ = Math.min(...zs) - 200;
  const maxZ = Math.max(...zs) + 200;
  const span = Math.max(maxX - minX, maxZ - minZ);
  // Icons a fixed share of the view, as on the map tab (1 at 420 m).
  return { box: `${minX.toFixed(0)} ${(-maxZ).toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxZ - minZ).toFixed(0)}`, k: span / 420 };
};

const Chart = ({ map, metro, city }: { map: MetroMapVm; metro: MapMetroVm; city: CityIndex | null }) => {
  const intents = useMetroIntents();
  const t = useT();
  const { box, k } = useMemo(() => fit(metro), [metro]);
  // Only the platform (under its ring) and the destination (over it) are named: the list beside it names the rest.
  const names = (id: MetroStationId): NamePlace => (id === map.from ? "below" : id === map.selected ? "above" : null);
  return (
    <div className="metro__chart metro-pick">
      <svg viewBox={box} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("metro.lineMap")} data-testid="metro-chart">
        {city && <CityShapes city={city} window={null} prefix="citymap" />}
        <MetroLayer metro={metro} k={k} route={map.preview?.route} here={map.from} selected={map.selected} names={names} onPick={(id) => intents.selectMetroStop(id)} />
      </svg>
    </div>
  );
};

const Stop = ({ stop, map, locale }: { stop: MetroStopVm; map: MetroMapVm; locale: Locale }) => {
  const intents = useMetroIntents();
  const t = useT();
  const fare = eur(locale, stop.fare);
  const chosen = map.selected === stop.id;
  const onRoute = !chosen && !stop.here && (map.preview?.route.includes(stop.id) ?? false);
  return (
    <li className={`metro__stop${stop.here ? " metro__stop--here" : ""}${chosen ? " metro__stop--to" : ""}${onRoute ? " metro__stop--route" : ""}`} data-testid={`metro-stop-${stop.id}`}>
      <span className="metro__dot" aria-hidden="true" />
      {stop.here ? (
        <>
          <span className="metro__name">{stop.name}</span>
          <span className="metro__here">{t("metro.here")}</span>
        </>
      ) : (
        <button type="button" className="metro__stop-btn" aria-pressed={chosen} onClick={() => intents.selectMetroStop(stop.id)} aria-label={t("metro.select", { station: stop.name, fare, seconds: stop.seconds })}>
          <span className="metro__name">{stop.name}</span>
          <span className="metro__fare">{`${t("metro.ticket", { fare })} · ${t("metro.time", { seconds: stop.seconds })}`}</span>
        </button>
      )}
    </li>
  );
};

/** The possible stations, without a ticket (ADR-0071). */
const Planned = ({ metro, locale }: { metro: MapMetroVm; locale: Locale }) => {
  const t = useT();
  if (metro.planned.length === 0) return null;
  const nameOf = (id: MetroStationId) => metro.stations.find((s) => s.id === id)?.name ?? id;
  return (
    <>
      <h3 className="metro__planned-head">{t("metro.planned.heading")}</h3>
      <ul className="metro__planned" data-testid="metro-planned">
        {metro.planned.map((p) => (
          <li key={p.id} aria-label={`${p.name}: ${t("metro.planned.noTicket")}`}>
            {`${p.name} · ${t("metro.planned")} · ${t("metro.planned.distance", { km: formatNumber(locale, Math.round(p.distance / 100) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), station: nameOf(p.from) })}`}
          </li>
        ))}
      </ul>
    </>
  );
};

/** The ticket, the second step: only with a destination chosen, the money and an unwatched platform. */
const Buy = ({ map, eddies, locale }: { map: MetroMapVm; eddies: number; locale: Locale }) => {
  const intents = useMetroIntents();
  const t = useT();
  const p = map.preview;
  const fare = eur(locale, p?.fare ?? 0);
  const short = p !== null && eddies < p.fare;
  return (
    <button
      type="button"
      className="metro__ticket metro__buy"
      data-testid="metro-buy"
      disabled={p === null || short || map.refusal !== null}
      onClick={() => intents.buyMetroTicket()}
      aria-label={p ? t("metro.ticketTo", { station: p.name, fare }) : undefined}
    >
      {p === null ? t("metro.buyNone") : short ? t("metro.noFunds", { fare }) : t("metro.buy", { fare })}
    </button>
  );
};

const Kiosk = ({ map }: { map: MetroMapVm }) => {
  const city = useUi((s) => s.map);
  const eddies = useUi((s) => s.eddies);
  const locale = useUi((s) => s.settings.locale);
  const intents = useMetroIntents();
  const t = useT();
  // Indexed while the kiosk is open only, like the map tab.
  const index = useMemo(() => (city ? indexCity(city) : null), [city]);
  const metro = city?.metro ?? null;
  const p = map.preview;
  const via = p ? p.route.slice(1, -1).map((id) => map.stops.find((s) => s.id === id)?.name ?? id) : [];
  return (
    <div className="metro metro--map" role="dialog" aria-label={t("metro.dialog")} data-testid="metro-map">
      <header className="metro__head">
        <div className="metro__eyebrow">{t("metro.kiosk")}</div>
        <h2 className="metro__line">{map.line}</h2>
        <div className="metro__wallet">€$ {amount(locale, eddies)}</div>
      </header>
      {map.refusal && (
        <p className="metro__refusal" role="alert" data-testid="metro-refusal">
          {map.refusal}
        </p>
      )}
      <div className="metro__body">
        {metro && <Chart map={map} metro={metro} city={index} />}
        <div className="metro__side">
          <ol className="metro__stops">
            {map.stops.map((stop) => (
              <Stop key={stop.id} stop={stop} map={map} locale={locale} />
            ))}
          </ol>
          {p ? <MetroPreview p={p} via={via} fare={eur(locale, p.fare)} refusal={map.refusal} city={index} metro={metro} /> : <p className="metro__hint">{t("metro.choose")}</p>}
          {metro && <Planned metro={metro} locale={locale} />}
        </div>
      </div>
      <div className="metro__actions">
        <button type="button" className="metro__close" onClick={() => intents.closeMetro()}>
          <span className="dialogue__key">E</span> {t("metro.leave")}
        </button>
        <Buy map={map} eddies={eddies} locale={locale} />
      </div>
    </div>
  );
};

/**
 * The line map at the ticket kiosk (ADR-0035, ADR-0071): the line over the city with the platform,
 * the list of stops with fares and times beside it (under it on a phone), the possible stations,
 * and once a destination is chosen (a click, a tap or the arrows) the route and the card of the
 * destination. The ticket is a second step; Esc or E leaves the kiosk.
 */
export const MetroMap = () => {
  const map = useUi((s) => s.metroMap);
  useMetroKioskKeys(map);
  return map ? <Kiosk map={map} /> : null;
};
