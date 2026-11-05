import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { Locale, MetroStationId } from "@seki/core";
import { CityShapes, type CityIndex, indexCity } from "../hud/city-layer";
import { useT } from "../i18n/use-t";
import type { MapBox } from "../store/map-vm";
import type { MapMetroVm, MetroMapVm, MetroStopVm } from "../store/metro-vm";
import { useMetroIntents, useUi } from "../use-ui";
import { MetroLayer, type NamePlace, kmOf } from "./metro-layer";
import { MetroPreview } from "./metro-preview";
import { useMetroKioskKeys } from "./use-metro-kiosk";

/** Amounts as the language writes them: Polish as before, English as en-GB. */
const amount = (locale: Locale, n: number) => n.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB");
export const eur = (locale: Locale, n: number) => `${amount(locale, n)} €$`;

/** A possible station this far beyond the line's stations is pinned to the edge of the kiosk's map, metres. */
const REACH = 1000;

/**
 * The view of the kiosk's map for a chart of `w` × `h` px: the stations and the possible stations
 * near the line, with room for the names, in the chart's own proportions. `k` is metres per px, so
 * the icons and the names keep their size on any screen (11 px names).
 */
export const fitChart = (metro: MapMetroVm, w: number, h: number): { box: MapBox; k: number } => {
  const sx = metro.stations.map((s) => s.x);
  const sz = metro.stations.map((s) => s.z);
  const line = { minX: Math.min(...sx) - REACH, maxX: Math.max(...sx) + REACH, minZ: Math.min(...sz) - REACH, maxZ: Math.max(...sz) + REACH };
  const near = metro.planned.filter((p) => p.x >= line.minX && p.x <= line.maxX && p.z >= line.minZ && p.z <= line.maxZ);
  const xs = [...sx, ...near.map((p) => p.x)];
  const zs = [...sz, ...near.map((p) => p.z)];
  // Room for the names, in px on each side: k solves span + 2 · margin · k = size · k.
  const [mx, mz] = [80, 34];
  const k = Math.max((Math.max(...xs) - Math.min(...xs)) / Math.max(1, w - 2 * mx), (Math.max(...zs) - Math.min(...zs)) / Math.max(1, h - 2 * mz));
  const box = { minX: Math.min(...xs) - mx * k, maxX: Math.max(...xs) + mx * k, minZ: Math.min(...zs) - mz * k, maxZ: Math.max(...zs) + mz * k };
  // The chart's proportions, the line in the middle.
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  return { box: { minX: cx - (k * w) / 2, maxX: cx + (k * w) / 2, minZ: cz - (k * h) / 2, maxZ: cz + (k * h) / 2 }, k };
};

/** The chart's size on screen; a fixed guess where nothing is laid out (tests). */
const useChartSize = (ref: RefObject<HTMLDivElement | null>): { w: number; h: number } => {
  const [size, setSize] = useState({ w: 640, h: 360 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const seen = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (Math.round(s.w) === Math.round(r.width) && Math.round(s.h) === Math.round(r.height) ? s : { w: r.width, h: r.height }));
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [ref]);
  return size;
};

const Chart = ({ map, metro, city }: { map: MetroMapVm; metro: MapMetroVm; city: CityIndex | null }) => {
  const intents = useMetroIntents();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useChartSize(ref);
  const { box, k } = useMemo(() => fitChart(metro, w, h), [metro, w, h]);
  // The platform's name under its ring, the destination's over it, the rest where there is room.
  const names = (id: MetroStationId): NamePlace => (id === map.from ? "below" : "above");
  const view = `${box.minX.toFixed(0)} ${(-box.maxZ).toFixed(0)} ${(box.maxX - box.minX).toFixed(0)} ${(box.maxZ - box.minZ).toFixed(0)}`;
  return (
    <div className="metro__chart metro-pick" ref={ref}>
      <svg viewBox={view} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("metro.lineMap")} data-testid="metro-chart">
        {city && <CityShapes city={city} window={box} prefix="citymap" />}
        <MetroLayer metro={metro} k={k} route={map.preview?.route} here={map.from} selected={map.selected} names={names} clamp={box} onPick={(id) => intents.selectMetroStop(id)} />
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
            {`${p.name} · ${t("metro.planned")} · ${t("metro.planned.distance", { km: kmOf(locale, p.distance), station: nameOf(p.from) })}`}
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
  // A chosen destination brings its card into view (on a phone it is under the map and the list).
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (map.selected) card.current?.scrollIntoView?.({ block: "nearest" });
  }, [map.selected]);
  return (
    <div className="metro metro--map" role="dialog" aria-label={t("metro.dialog")} data-testid="metro-map">
      <header className="metro__head">
        <div className="metro__eyebrow">{t("metro.kiosk")}</div>
        <h2 className="metro__line">{map.line}</h2>
        <div className="metro__wallet">€$ {amount(locale, eddies)}</div>
      </header>
      {/* Only this part scrolls: the head and the buttons stay, nothing runs under them. */}
      <div className="metro__scroll" data-testid="metro-scroll">
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
            <div ref={card}>{p ? <MetroPreview p={p} via={via} fare={eur(locale, p.fare)} refusal={map.refusal} city={index} metro={metro} /> : <p className="metro__hint">{t("metro.choose")}</p>}</div>
            {metro && <Planned metro={metro} locale={locale} />}
          </div>
        </div>
      </div>
      <div className="metro__actions" data-testid="metro-actions">
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
