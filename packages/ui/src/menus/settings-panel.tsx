import type { GraphicsQuality, SettingsVm } from "../store/ui-store";
import { useIntents, useUi } from "../use-ui";

const QUALITY: readonly (readonly [GraphicsQuality, string])[] = [
  ["high", "Wysoka"],
  ["low", "Niska"],
];

const Slider = ({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: keyof SettingsVm;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) => (
  <label className="settings__row" htmlFor={`setting-${id}`}>
    <span className="settings__label">{label}</span>
    <input
      id={`setting-${id}`}
      className="settings__slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    />
    <span className="settings__value">{format(value)}</span>
  </label>
);

const times = (v: number) => `${v.toFixed(1).replace(".", ",")}×`;
const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Graphics, look sensitivity and volume. The app saves them; this only shows and edits. */
export const SettingsPanel = () => {
  const settings = useUi((s) => s.settings);
  const reloadNeeded = useUi((s) => s.reloadNeeded);
  const intents = useIntents();
  return (
    <div className="settings" data-testid="settings">
      <div className="settings__row">
        <span className="settings__label">Jakość grafiki</span>
        <div className="settings__choice" role="radiogroup" aria-label="Jakość grafiki">
          {QUALITY.map(([q, label]) => (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={settings.quality === q}
              className={`settings__option${settings.quality === q ? " settings__option--on" : ""}`}
              onClick={() => intents.changeSettings({ quality: q })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Slider
        id="mouseSensitivity"
        label="Czułość myszy"
        value={settings.mouseSensitivity}
        min={0.2}
        max={3}
        step={0.1}
        format={times}
        onChange={(v) => intents.changeSettings({ mouseSensitivity: v })}
      />
      <Slider
        id="touchSensitivity"
        label="Czułość dotyku"
        value={settings.touchSensitivity}
        min={0.2}
        max={3}
        step={0.1}
        format={times}
        onChange={(v) => intents.changeSettings({ touchSensitivity: v })}
      />
      <Slider id="volume" label="Głośność" value={settings.volume} min={0} max={1} step={0.05} format={percent} onChange={(v) => intents.changeSettings({ volume: v })} />
      {reloadNeeded && (
        <div className="settings__note" data-testid="settings-reload">
          <p>Jakość grafiki zmieni się po przeładowaniu. Najpierw zapisz grę, bo niezapisany postęp przepadnie.</p>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.reload()}>
            Przeładuj teraz
          </button>
        </div>
      )}
    </div>
  );
};
