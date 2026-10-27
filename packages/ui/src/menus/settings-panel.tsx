import { useEffect, useState } from "react";
import type { AimMode, GraphicsQuality, SettingsVm } from "../store/ui-store";
import { useIntents, useUi } from "../use-ui";
import { RESERVED_KEYS, keyLabel } from "./key-label";

const QUALITY: readonly (readonly [GraphicsQuality, string])[] = [
  ["high", "Wysoka"],
  ["low", "Niska"],
];

const AIM_MODES: readonly (readonly [AimMode, string])[] = [
  ["hold", "Przytrzymaj"],
  ["toggle", "Przełącz"],
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
const degrees = (v: number) => `${Math.round(v)}°`;

const Choice = <T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) => (
  <div className="settings__row">
    <span className="settings__label">{label}</span>
    <div className="settings__choice" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`settings__option${value === v ? " settings__option--on" : ""}`} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  </div>
);

const ON_OFF: readonly (readonly ["on" | "off", string])[] = [
  ["off", "Nie"],
  ["on", "Tak"],
];

type Section = "general" | "mouse" | "keys";
const SECTIONS: readonly (readonly [Section, string])[] = [
  ["general", "Ogólne"],
  ["mouse", "Mysz i kamera"],
  ["keys", "Klawisze"],
];

/** The key list: click "Zmień", then press a key, a mouse button or turn the wheel; Esc cancels. */
const KeyBindings = () => {
  const controls = useUi((s) => s.controls);
  const intents = useIntents();
  const [listening, setListening] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => {
    if (!listening) return;
    const take = (code: string, e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (code === "Escape") {
        setListening(null);
        return;
      }
      if (RESERVED_KEYS.has(code)) {
        setRefused(code);
        return;
      }
      intents.bindKey(listening, code);
      setRefused(null);
      setListening(null);
    };
    const onKey = (e: KeyboardEvent) => take(e.code, e);
    const onMouse = (e: MouseEvent) => take(`Mouse${e.button}`, e);
    const onWheel = (e: WheelEvent) => take(e.deltaY > 0 ? "WheelDown" : "WheelUp", e);
    // Capture phase on the window: the game's own key handlers (pause, saves) never see the press.
    window.addEventListener("keydown", onKey, true);
    // A tick later, so the click that started listening is not taken as the new binding.
    const t = setTimeout(() => {
      window.addEventListener("mousedown", onMouse, true);
      window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("wheel", onWheel, true);
    };
  }, [listening, intents]);
  return (
    <div className="keys" data-testid="key-bindings">
      <ul className="keys__list">
        {controls.map((c) => (
          <li key={c.action} className={`keys__row${listening === c.action ? " keys__row--listening" : ""}`}>
            <span className="keys__label">{c.label}</span>
            <span className="keys__codes">{listening === c.action ? "Naciśnij klawisz…" : c.codes.length > 0 ? c.codes.map(keyLabel).join(" / ") : "brak"}</span>
            <button type="button" className="settings__option" aria-label={`Zmień klawisz: ${c.label}`} onClick={() => setListening(listening === c.action ? null : c.action)}>
              {listening === c.action ? "Anuluj" : "Zmień"}
            </button>
          </li>
        ))}
      </ul>
      {refused && <p className="settings__note">Klawisz {keyLabel(refused)} jest zajęty przez menu gry.</p>}
      <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.resetControls()}>
        Przywróć domyślne klawisze
      </button>
    </div>
  );
};

/** Graphics, sound, mouse, camera and keys. The app saves them; this only shows and edits. */
export const SettingsPanel = () => {
  const settings = useUi((s) => s.settings);
  const reloadNeeded = useUi((s) => s.reloadNeeded);
  const intents = useIntents();
  const [section, setSection] = useState<Section>("general");
  const set = (patch: Partial<SettingsVm>) => intents.changeSettings(patch);
  return (
    <div className="settings" data-testid="settings">
      <div className="settings__tabs" role="tablist" aria-label="Ustawienia">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={section === id} className={`settings__option${section === id ? " settings__option--on" : ""}`} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </div>
      {section === "general" && (
        <>
          <Choice label="Jakość grafiki" value={settings.quality} options={QUALITY} onChange={(quality) => set({ quality })} />
          <Slider id="volume" label="Głośność" value={settings.volume} min={0} max={1} step={0.05} format={percent} onChange={(v) => set({ volume: v })} />
          <Choice label="Podpowiedzi" value={settings.hints ? "on" : "off"} options={ON_OFF} onChange={(v) => set({ hints: v === "on" })} />
          <Slider id="touchSensitivity" label="Czułość dotyku" value={settings.touchSensitivity} min={0.2} max={3} step={0.1} format={times} onChange={(v) => set({ touchSensitivity: v })} />
        </>
      )}
      {section === "mouse" && (
        <>
          <Slider id="mouseSensitivity" label="Czułość myszy" value={settings.mouseSensitivity} min={0.2} max={3} step={0.1} format={times} onChange={(v) => set({ mouseSensitivity: v })} />
          <Slider id="adsSensitivity" label="Czułość przy celowaniu" value={settings.adsSensitivity} min={0.3} max={2} step={0.05} format={times} onChange={(v) => set({ adsSensitivity: v })} />
          <Choice label="Odwróć oś Y" value={settings.invertY ? "on" : "off"} options={ON_OFF} onChange={(v) => set({ invertY: v === "on" })} />
          <Slider id="fov" label="Pole widzenia" value={settings.fov} min={50} max={80} step={1} format={degrees} onChange={(v) => set({ fov: v })} />
          <Choice label="Celowanie (PPM)" value={settings.aimMode} options={AIM_MODES} onChange={(aimMode) => set({ aimMode })} />
          <Choice label="Kucanie" value={settings.crouchMode} options={AIM_MODES} onChange={(crouchMode) => set({ crouchMode })} />
          <Choice label="Sprint" value={settings.sprintMode} options={AIM_MODES} onChange={(sprintMode) => set({ sprintMode })} />
        </>
      )}
      {section === "keys" && <KeyBindings />}
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
