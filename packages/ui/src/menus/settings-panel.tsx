import { useEffect, useState } from "react";
import { LOCALES, type Locale } from "@seki/core";
import type { MessageKey } from "../i18n/en";
import { type Translate, isMessageKey } from "../i18n/t";
import { useT } from "../i18n/use-t";
import { type ColorblindMode, type DamageNumbersMode, HUD_SCALE_RANGE } from "../store/hud-vm";
import type { AimMode, ControlBindingVm, GraphicsQuality, SettingsVm } from "../store/ui-store";
import { TOKENS } from "../hud/tokens";
import { useSettingsIntents, useUi } from "../use-ui";
import { RESERVED_KEYS, keyLabel } from "./key-label";
import { useFieldOfView } from "./use-field-of-view";

/** A choice's values with the catalog keys of their names (ADR-0056). */
type Options<T extends string> = readonly (readonly [T, MessageKey])[];

const QUALITY: Options<GraphicsQuality> = [
  ["high", "settings.quality.high"],
  ["medium", "settings.quality.medium"],
  ["low", "settings.quality.low"],
];

const AIM_MODES: Options<AimMode> = [
  ["hold", "settings.mode.hold"],
  ["toggle", "settings.mode.toggle"],
];

/** Each language under its own name, so a player can find theirs whatever is set now. */
const LANGUAGES: Options<Locale> = LOCALES.map((l) => [l, `settings.language.${l}`] as const);

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

/** One decimal as before (`toFixed` rounding); only the separator follows the language. */
const times = (locale: Locale) => (v: number) => `${locale === "pl" ? v.toFixed(1).replace(".", ",") : v.toFixed(1)}×`;
const percent = (v: number) => `${Math.round(v * 100)}%`;
const degrees = (v: number) => `${Math.round(v)}°`;

/** Horizontal field of view from the hip (ADR-0049); the same width of the street on any screen. */
const FieldOfViewSlider = () => {
  const fov = useFieldOfView();
  const t = useT();
  return <Slider id="horizontalFov" label={t("settings.fov")} value={fov.degrees} min={fov.min} max={fov.max} step={1} format={degrees} onChange={fov.set} />;
};

const Choice = <T extends string>({ label, value, options, onChange }: { label: MessageKey; value: T; options: Options<T>; onChange: (v: T) => void }) => {
  const t = useT();
  return (
    <div className="settings__row">
      <span className="settings__label">{t(label)}</span>
      <div className="settings__choice" role="radiogroup" aria-label={t(label)}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={`settings__option${value === v ? " settings__option--on" : ""}`} onClick={() => onChange(v)}>
            {t(text)}
          </button>
        ))}
      </div>
    </div>
  );
};

const ON_OFF: Options<"on" | "off"> = [
  ["off", "settings.off"],
  ["on", "settings.on"],
];

/** A yes-or-no setting as a choice of two. */
const Toggle = ({ label, on, onChange }: { label: MessageKey; on: boolean; onChange: (on: boolean) => void }) => (
  <Choice label={label} value={on ? "on" : "off"} options={ON_OFF} onChange={(v) => onChange(v === "on")} />
);

type Section = "general" | "mouse" | "keys" | "access";
const SECTIONS: Options<Section> = [
  ["general", "settings.tab.general"],
  ["mouse", "settings.tab.mouse"],
  ["keys", "settings.tab.keys"],
  ["access", "settings.tab.access"],
];

const DAMAGE_NUMBERS: Options<DamageNumbersMode> = [
  ["off", "settings.damageNumbers.off"],
  ["hit", "settings.damageNumbers.hit"],
  ["total", "settings.damageNumbers.total"],
];

const COLORBLIND: Options<ColorblindMode> = [
  ["off", "settings.colorblind.off"],
  ["protan", "settings.colorblind.protan"],
  ["deutan", "settings.colorblind.deutan"],
  ["tritan", "settings.colorblind.tritan"],
];

/** The colour tokens with their icons, so the chosen palette can be checked at a glance. */
const TokenLegend = () => {
  const t = useT();
  return (
    <ul className="tokens" data-testid="token-legend" aria-label={t("settings.tokens")}>
      {TOKENS.map((token) => (
        <li key={token.id} className={`token token--${token.id}`}>
          <span className="token__icon" aria-hidden="true">
            {token.icon}
          </span>
          {t(`settings.token.${token.id}`)}
        </li>
      ))}
    </ul>
  );
};

type SectionProps = { readonly settings: SettingsVm; readonly set: (patch: Partial<SettingsVm>) => void };

const Accessibility = ({ settings, set }: SectionProps) => {
  const t = useT();
  return (
    <>
      <Slider id="hudScale" label={t("settings.hudScale")} value={settings.hudScale} min={HUD_SCALE_RANGE[0]} max={HUD_SCALE_RANGE[1]} step={0.05} format={percent} onChange={(v) => set({ hudScale: v })} />
      <Toggle label="settings.legibleFont" on={settings.legibleFont} onChange={(legibleFont) => set({ legibleFont })} />
      <Toggle label="settings.reduceFlashes" on={settings.reduceFlashes} onChange={(reduceFlashes) => set({ reduceFlashes })} />
      <Toggle label="settings.untimedBreach" on={settings.untimedBreach} onChange={(untimedBreach) => set({ untimedBreach })} />
      <Choice label="settings.colorblind" value={settings.colorblind} options={COLORBLIND} onChange={(colorblind) => set({ colorblind })} />
      <TokenLegend />
    </>
  );
};

/** Language first: whoever opens the options in a language they do not read finds it at once. */
const General = ({ settings, set }: SectionProps) => {
  const t = useT();
  return (
    <>
      <Choice label="settings.language" value={settings.locale} options={LANGUAGES} onChange={(locale) => set({ locale })} />
      <Choice label="settings.quality" value={settings.quality} options={QUALITY} onChange={(quality) => set({ quality })} />
      <Slider id="volume" label={t("settings.volume")} value={settings.volume} min={0} max={1} step={0.05} format={percent} onChange={(v) => set({ volume: v })} />
      <Slider id="musicVolume" label={t("settings.musicVolume")} value={settings.musicVolume} min={0} max={1} step={0.05} format={percent} onChange={(v) => set({ musicVolume: v })} />
      <Slider id="sfxVolume" label={t("settings.sfxVolume")} value={settings.sfxVolume} min={0} max={1} step={0.05} format={percent} onChange={(v) => set({ sfxVolume: v })} />
      <Slider id="ambienceVolume" label={t("settings.ambienceVolume")} value={settings.ambienceVolume} min={0} max={1} step={0.05} format={percent} onChange={(v) => set({ ambienceVolume: v })} />
      <Toggle label="settings.hints" on={settings.hints} onChange={(hints) => set({ hints })} />
      <Slider id="touchSensitivity" label={t("settings.touchSensitivity")} value={settings.touchSensitivity} min={0.2} max={3} step={0.1} format={times(settings.locale)} onChange={(v) => set({ touchSensitivity: v })} />
      <Toggle label="settings.hudAlwaysShow" on={settings.hudAlwaysShow} onChange={(hudAlwaysShow) => set({ hudAlwaysShow })} />
      <Choice label="settings.damageNumbers" value={settings.damageNumbers} options={DAMAGE_NUMBERS} onChange={(damageNumbers) => set({ damageNumbers })} />
      <Toggle label="settings.mapMarkers" on={settings.mapMarkers} onChange={(mapMarkers) => set({ mapMarkers })} />
      <Toggle label="settings.highlights" on={settings.highlights} onChange={(highlights) => set({ highlights })} />
    </>
  );
};

const MouseAndCamera = ({ settings, set }: SectionProps) => {
  const t = useT();
  const format = times(settings.locale);
  return (
    <>
      <Slider id="mouseSensitivity" label={t("settings.mouseSensitivity")} value={settings.mouseSensitivity} min={0.2} max={3} step={0.1} format={format} onChange={(v) => set({ mouseSensitivity: v })} />
      <Slider id="adsSensitivity" label={t("settings.adsSensitivity")} value={settings.adsSensitivity} min={0.3} max={2} step={0.05} format={format} onChange={(v) => set({ adsSensitivity: v })} />
      <Toggle label="settings.invertY" on={settings.invertY} onChange={(invertY) => set({ invertY })} />
      <FieldOfViewSlider />
      <Choice label="settings.aimMode" value={settings.aimMode} options={AIM_MODES} onChange={(aimMode) => set({ aimMode })} />
      <Choice label="settings.crouchMode" value={settings.crouchMode} options={AIM_MODES} onChange={(crouchMode) => set({ crouchMode })} />
      <Choice label="settings.sprintMode" value={settings.sprintMode} options={AIM_MODES} onChange={(sprintMode) => set({ sprintMode })} />
    </>
  );
};

/** A control's name in the chosen language; one the catalogs do not know keeps the app's label. */
const controlName = (t: Translate, c: ControlBindingVm): string => {
  const key = `control.${c.action}`;
  return isMessageKey(key) ? t(key) : c.label;
};

/** The key list: click "Change", then press a key, a mouse button or turn the wheel; Esc cancels. */
const KeyBindings = () => {
  const controls = useUi((s) => s.controls);
  const intents = useSettingsIntents();
  const t = useT();
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
            <span className="keys__label">{controlName(t, c)}</span>
            <span className="keys__codes">
              {listening === c.action ? t("settings.keys.listening") : c.codes.length > 0 ? c.codes.map((code) => keyLabel(code, t)).join(" / ") : t("settings.keys.none")}
            </span>
            <button
              type="button"
              className="settings__option"
              aria-label={t("settings.keys.changeLabel", { control: controlName(t, c) })}
              onClick={() => setListening(listening === c.action ? null : c.action)}
            >
              {listening === c.action ? t("settings.keys.cancel") : t("settings.keys.change")}
            </button>
          </li>
        ))}
      </ul>
      {refused && <p className="settings__note">{t("settings.keys.reserved", { key: keyLabel(refused, t) })}</p>}
      <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.resetControls()}>
        {t("settings.keys.reset")}
      </button>
    </div>
  );
};

/** Language, graphics, sound, mouse, camera and keys. The app saves them; this only shows and edits. */
export const SettingsPanel = () => {
  const settings = useUi((s) => s.settings);
  const reloadNeeded = useUi((s) => s.reloadNeeded);
  const intents = useSettingsIntents();
  const t = useT();
  const [section, setSection] = useState<Section>("general");
  const set = (patch: Partial<SettingsVm>) => intents.changeSettings(patch);
  return (
    <div className="settings" data-testid="settings">
      <div className="settings__tabs" role="tablist" aria-label={t("settings.heading")}>
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={section === id} className={`settings__option${section === id ? " settings__option--on" : ""}`} onClick={() => setSection(id)}>
            {t(label)}
          </button>
        ))}
      </div>
      {section === "general" && <General settings={settings} set={set} />}
      {section === "mouse" && <MouseAndCamera settings={settings} set={set} />}
      {section === "keys" && <KeyBindings />}
      {section === "access" && <Accessibility settings={settings} set={set} />}
      {reloadNeeded && (
        <div className="settings__note" data-testid="settings-reload">
          <p>{t("settings.reload.note")}</p>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.reload()}>
            {t("settings.reload.now")}
          </button>
        </div>
      )}
    </div>
  );
};
