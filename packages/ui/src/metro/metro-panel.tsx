import { useEffect } from "react";
import type { MetroMapVm, MetroStopVm } from "../store/ui-store";
import { useMetroIntents, useUi } from "../use-ui";

const eur = (n: number) => `${n.toLocaleString("pl-PL")} €$`;

const Stop = ({ stop, map, eddies }: { stop: MetroStopVm; map: MetroMapVm; eddies: number }) => {
  const intents = useMetroIntents();
  const short = eddies < stop.fare;
  const disabled = stop.here || short || map.refusal !== null;
  return (
    <li className={`metro__stop${stop.here ? " metro__stop--here" : ""}`} data-testid={`metro-stop-${stop.id}`}>
      <span className="metro__dot" aria-hidden="true" />
      <span className="metro__name">{stop.name}</span>
      {stop.here ? (
        <span className="metro__here">Jesteś tutaj</span>
      ) : (
        <button type="button" className="metro__ticket" disabled={disabled} onClick={() => intents.travelMetro(stop.id)} aria-label={`Bilet do: ${stop.name}, ${eur(stop.fare)}`}>
          {short ? `Brak środków · ${eur(stop.fare)}` : `Bilet · ${eur(stop.fare)}`}
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
  const intents = useMetroIntents();
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
    <div className="metro" role="dialog" aria-label="Mapa metra" data-testid="metro-map">
      <header className="metro__head">
        <div className="metro__eyebrow">Kiosk biletowy</div>
        <h2 className="metro__line">{map.line}</h2>
        <div className="metro__wallet">€$ {eddies.toLocaleString("pl-PL")}</div>
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
        <span className="dialogue__key">E</span> Odejdź od kiosku
      </button>
    </div>
  );
};

/** The ride (ADR-0035): the line, the destination, the progress and the ink lines as subtitles. The 3D car is the engine's. */
export const MetroRide = () => {
  const ride = useUi((s) => s.metroRide);
  if (!ride) return null;
  const pct = Math.round(ride.progress * 100);
  return (
    <div className="metro-ride" role="status" aria-live="polite" data-testid="metro-ride">
      <div className="metro-ride__panel">
        <div className="metro-ride__line">{ride.line}</div>
        <div className="metro-ride__route">
          {ride.fromName} <span aria-hidden="true">→</span> <b data-testid="metro-ride-to">{ride.toName}</b>
        </div>
        <div className="metro-ride__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Postęp przejazdu">
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
