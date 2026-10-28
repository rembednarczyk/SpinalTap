import { MAX_HEAT } from "@seki/core";
import type { DetectionVm } from "../store/hud-vm";
import { useUi } from "../use-ui";

const STATE_LABEL: Readonly<Record<DetectionVm["state"], string>> = { suspicious: "Podejrzliwy", searching: "Szuka", alerted: "Alarm" };
/** A shape per state as well as a colour: ?, … and !. */
const STATE_GLYPH: Readonly<Record<DetectionVm["state"], string>> = { suspicious: "?", searching: "…", alerted: "!" };

/**
 * Heat 0..3 (ADR-0028): filled stars for the level; dim while the security searches; blinking
 * (once a second, far under the 3 Hz limit; steady with reduced flashes) just before it drops.
 */
export const HeatStars = () => {
  const heat = useUi((s) => s.heat);
  if (heat.level === 0) return null;
  const cls = `heat${heat.searching ? " heat--searching" : ""}${heat.ending ? " heat--ending" : ""}`;
  const label = `Pościg: ${heat.level} z ${MAX_HEAT}${heat.searching ? ", szukają cię" : ""}`;
  return (
    <div className={cls} data-testid="heat" data-level={heat.level} role="status" aria-label={label}>
      {Array.from({ length: MAX_HEAT }, (_, i) => (
        <span key={i} className={`heat__star${i < heat.level ? " heat__star--on" : ""}`} aria-hidden="true">
          {i < heat.level ? "★" : "☆"}
        </span>
      ))}
      {heat.searching && <span className="heat__note">szukają</span>}
    </div>
  );
};

const RADIUS = 46;
const ARC = Math.PI / 5;

/** An arc of the ring at `angle`, filled with `level` of its length. */
const arcPath = (angle: number, span: number): string => {
  const a0 = angle - span / 2;
  const a1 = angle + span / 2;
  const p = (a: number) => `${(Math.sin(a) * RADIUS).toFixed(2)} ${(-Math.cos(a) * RADIUS).toFixed(2)}`;
  return `M ${p(a0)} A ${RADIUS} ${RADIUS} 0 0 1 ${p(a1)}`;
};

/**
 * Who is noticing the player: an arc on the ring round the crosshair in the observer's
 * direction (ahead is up), filled by its suspicion, coloured by state and marked ?, … or !.
 */
export const DetectionRing = () => {
  const detection = useUi((s) => s.detection);
  if (detection.length === 0) return null;
  return (
    <svg className="detection" viewBox="-60 -60 120 120" data-testid="detection" aria-label="Wykrycie">
      {detection.map((d) => {
        const tip = { x: Math.sin(d.angle) * (RADIUS + 9), y: -Math.cos(d.angle) * (RADIUS + 9) };
        return (
          <g key={d.id} className={`detection__arc detection__arc--${d.state}`} data-testid={`detection-${d.state}`}>
            <title>{STATE_LABEL[d.state]}</title>
            <path className="detection__track" d={arcPath(d.angle, ARC)} />
            <path className="detection__fill" d={arcPath(d.angle - (ARC * (1 - d.level)) / 2, ARC * Math.max(0.05, d.level))} />
            <text className="detection__glyph" x={tip.x.toFixed(2)} y={tip.y.toFixed(2)}>
              {STATE_GLYPH[d.state]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
