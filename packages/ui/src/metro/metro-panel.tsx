import { useEffect } from "react";
import type { Locale } from "@seki/core";
import { useT } from "../i18n/use-t";
import type { MetroMapVm, MetroStopVm } from "../store/ui-store";
import { useMetroIntents, useUi } from "../use-ui";

/** Amounts as the language writes them: Polish as before, English as en-GB. */
const amount = (locale: Locale, n: number) => n.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB");
const eur = (locale: Locale, n: number) => `${amount(locale, n)} €$`;

const Stop = ({ stop, map, eddies }: { stop: MetroStopVm; map: MetroMapVm; eddies: number }) => {
  const intents = useMetroIntents();
  const t = useT();
  const locale = useUi((s) => s.settings.locale);
  const fare = eur(locale, stop.fare);
  const short = eddies < stop.fare;
  const disabled = stop.here || short || map.refusal !== null;
  return (
    <li className={`metro__stop${stop.here ? " metro__stop--here" : ""}`} data-testid={`metro-stop-${stop.id}`}>
      <span className="metro__dot" aria-hidden="true" />
      <span className="metro__name">{stop.name}</span>
      {stop.here ? (
        <span className="metro__here">{t("metro.here")}</span>
      ) : (
        <button type="button" className="metro__ticket" disabled={disabled} onClick={() => intents.travelMetro(stop.id)} aria-label={t("metro.ticketTo", { station: stop.name, fare })}>
          {short ? t("metro.noFunds", { fare }) : t("metro.ticket", { fare })}
        </button>
      )}
    </li>
  );
};

/**
 * The line map at the ticket kiosk (ADR-0035): every stop of the line with its fare from here.
 * A tap or a click buys the ticket and the ride starts; Esc or E leaves the kiosk.
 */
export const MetroMap = () => {
  const map = useUi((s) => s.metroMap);
  const eddies = useUi((s) => s.eddies);
  const locale = useUi((s) => s.settings.locale);
  const intents = useMetroIntents();
  const t = useT();
  useEffect(() => {
    if (!map) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyE") intents.closeMetro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, intents]);
  if (!map) return null;
  return (
    <div className="metro" role="dialog" aria-label={t("metro.dialog")} data-testid="metro-map">
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
      <ol className="metro__stops">
        {map.stops.map((stop) => (
          <Stop key={stop.id} stop={stop} map={map} eddies={eddies} />
        ))}
      </ol>
      <button type="button" className="metro__close" onClick={() => intents.closeMetro()}>
        <span className="dialogue__key">E</span> {t("metro.leave")}
      </button>
    </div>
  );
};

/** The ride (ADR-0035): the line, the destination, the progress and the ink lines as subtitles. The 3D car is the engine's. */
export const MetroRide = () => {
  const ride = useUi((s) => s.metroRide);
  const t = useT();
  if (!ride) return null;
  const pct = Math.round(ride.progress * 100);
  return (
    <div className="metro-ride" role="status" aria-live="polite" data-testid="metro-ride">
      <div className="metro-ride__panel">
        <div className="metro-ride__line">{ride.line}</div>
        <div className="metro-ride__route">
          {ride.fromName} <span aria-hidden="true">→</span> <b data-testid="metro-ride-to">{ride.toName}</b>
        </div>
        <div className="metro-ride__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("metro.progress")}>
          <div className="metro-ride__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {ride.caption && (
        <p className="metro-ride__caption" data-testid="metro-caption">
          {ride.caption.speaker && <b>{ride.caption.speaker}: </b>}
          {ride.caption.text}
        </p>
      )}
    </div>
  );
};
