import { useT } from "../i18n/use-t";
import { useUi } from "../use-ui";

export { MetroMap } from "./metro-kiosk";

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
