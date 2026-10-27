import { type CSSProperties, useEffect, useState } from "react";
import type { DayPhase } from "@seki/core";
import { fovRadians } from "../store/ui-store";
import { useUi } from "../use-ui";
import { AbilityWidget } from "./ability-widget";
import { Minimap } from "./minimap";
import { Toasts } from "./toasts";
import { WeaponStrip } from "./weapon-strip";
import type { TouchPadSink } from "../touch/touch-pad-sink";

/** Default vertical field of view of the game camera in radians (engine CameraRig; the settings change it). */
export const HUD_CAMERA_FOV = 1.08;

/**
 * Aim cone half-angle -> tick offset as a share of half the viewport height. `zoom` is the
 * current field of view as a share of the hip one (aiming down sights narrows it).
 */
export const spreadToScreen = (spread: number, zoom = 1, fov = HUD_CAMERA_FOV): number => Math.tan(Math.max(0, spread)) / Math.tan((fov * zoom) / 2);

/**
 * Four ticks that sit where the aim cone meets the screen: they spread apart while moving
 * and after shots, and pull in while crouched or aiming down sights. A melee guard turns them
 * into a bracket. A confirmed hit flashes them, a head hit red.
 */
const Crosshair = () => {
  const hit = useUi((s) => s.hitMarker);
  const zone = useUi((s) => s.hitZone);
  const spread = useUi((s) => s.aimSpread);
  const crouched = useUi((s) => s.crouched);
  const aiming = useUi((s) => s.aiming);
  const zoom = useUi((s) => s.aimZoom);
  const blocking = useUi((s) => s.blocking);
  // The camera's hip field of view follows the settings.
  const fov = useUi((s) => fovRadians(s.settings.fov));
  const [flash, setFlash] = useState<"hit" | "head" | null>(null);
  useEffect(() => {
    if (hit === 0) return;
    const head = zone === "head";
    setFlash(head ? "head" : "hit");
    const t = setTimeout(() => setFlash(null), head ? 220 : 120);
    return () => clearTimeout(t);
  }, [hit, zone]);
  const cls = ["crosshair", crouched && "crosshair--crouched", aiming && "crosshair--aiming", blocking && "crosshair--guard", flash && "crosshair--hit", flash === "head" && "crosshair--head"].filter(Boolean).join(" ");
  const style = { "--spread": spreadToScreen(spread, zoom, fov).toFixed(4) } as CSSProperties;
  return (
    <div className={cls} style={style} data-testid="crosshair" data-spread={spread.toFixed(3)}>
      <span className="crosshair__tick crosshair__tick--top" />
      <span className="crosshair__tick crosshair__tick--bottom" />
      <span className="crosshair__tick crosshair__tick--left" />
      <span className="crosshair__tick crosshair__tick--right" />
      {flash === "head" && <span className="crosshair__x" />}
    </div>
  );
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

export const Hud = ({ touch }: { touch?: TouchPadSink | undefined } = {}) => {
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
      <WeaponStrip pad={touch} />
      <Minimap />
      <div className="hud__camera">{cameraMode} · [V] · [X] broń · [1-3] slot · [R] przeładuj · [C] kucanie · [Spacja] skok · [I] ekwipunek · [Tab] karta · [J] dziennik</div>
      {prompt && (
        <div className="hud__prompt" data-testid="prompt">
          <kbd>E</kbd> {prompt}
        </div>
      )}
      <Toasts />
    </div>
  );
};
