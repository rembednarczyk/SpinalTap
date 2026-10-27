import { useEffect, useState } from "react";
import type { DayPhase } from "@seki/core";
import { useUi } from "../use-ui";
import { AbilityWidget } from "./ability-widget";
import { Minimap } from "./minimap";
import { Toasts } from "./toasts";

const Crosshair = () => {
  const hit = useUi((s) => s.hitMarker);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (hit === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 120);
    return () => clearTimeout(t);
  }, [hit]);
  return <div className={`crosshair${flash ? " crosshair--hit" : ""}`} data-testid="crosshair" />;
};

const HurtVignette = () => {
  const hurt = useUi((s) => s.hurtFlash);
  return hurt > 0 ? <div key={hurt} className="hurt-vignette" /> : null;
};

const PHASE_LABELS: Readonly<Record<DayPhase, string>> = { night: "noc", dawn: "świt", day: "dzień", dusk: "zmierzch" };

/** Game time of day, e.g. "Dzień 2 · noc 01:40". */
const Clock = () => {
  const clock = useUi((s) => s.clock);
  const day = useUi((s) => s.day);
  const phase = useUi((s) => s.dayPhase);
  if (!clock) return null;
  return (
    <div className={`hud__clock hud__clock--${phase}`} data-testid="clock" aria-label="Czas gry">
      <span className="hud__clock-day">Dzień {day}</span>
      <span className="hud__clock-phase">{PHASE_LABELS[phase]}</span>
      <span className="hud__clock-time">{clock}</span>
    </div>
  );
};

export const Hud = () => {
  const hp = useUi((s) => s.hp);
  const maxHp = useUi((s) => s.maxHp);
  const eddies = useUi((s) => s.eddies);
  const alias = useUi((s) => s.alias);
  const questTitle = useUi((s) => s.questTitle);
  const objective = useUi((s) => s.objective);
  const cameraMode = useUi((s) => s.cameraMode);
  const prompt = useUi((s) => s.prompt);
  const hpPct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));

  return (
    <div className="hud" data-testid="hud">
      <HurtVignette />
      <Crosshair />
      <div className="hud__identity">
        <div className="hud__name">{alias ?? "???"}</div>
        <div className="hud__hp" aria-label="Zdrowie">
          <div className={`hud__hp-fill${hpPct < 30 ? " hud__hp-fill--low" : ""}`} style={{ width: `${hpPct}%` }} />
        </div>
        <div className="hud__hp-label">
          {Math.ceil(hp)} / {maxHp}
        </div>
      </div>
      <div className="hud__wallet" data-testid="eddies">
        <span className="hud__currency">€$</span> {eddies.toLocaleString("pl-PL")}
      </div>
      <Clock />
      {objective && (
        <div className="hud__objective" data-testid="objective">
          <div className="hud__quest-title">{questTitle}</div>
          <div>{objective}</div>
        </div>
      )}
      <AbilityWidget />
      <Minimap />
      <div className="hud__camera">{cameraMode} · [V] · [X] broń · [Tab] postać · [J] dziennik</div>
      {prompt && (
        <div className="hud__prompt" data-testid="prompt">
          <kbd>E</kbd> {prompt}
        </div>
      )}
      <Toasts />
    </div>
  );
};
