import type { ControlBindingVm } from "../store/ui-store";
import { useUi } from "../use-ui";
import { keyLabel } from "./key-label";

/** Keys before the player's bindings arrive (and in tests): the defaults. */
const FALLBACK: readonly [string, string][] = [
  ["WASD", "ruch"],
  ["Shift", "sprint"],
  ["Spacja", "skok"],
  ["C", "kucanie"],
  ["LPM / PPM", "strzał / celowanie"],
  ["R", "przeładowanie"],
  ["E / F", "interakcja"],
  ["Kółko", "zmiana broni"],
];

const keysOf = (controls: readonly ControlBindingVm[], action: string): string =>
  (controls.find((c) => c.action === action)?.codes ?? []).map(keyLabel).join(" / ");

/** The controls that matter in play, from the current bindings, then the fixed menu keys. */
const fromBindings = (controls: readonly ControlBindingVm[]): [string, string][] => {
  const move = ["forward", "left", "back", "right"].map((a) => keysOf(controls, a).split(" / ")[0] ?? "").join("");
  const pair = (a: string, b: string) => [keysOf(controls, a), keysOf(controls, b)].filter(Boolean).join(" / ");
  return [
    [move, "ruch"],
    [keysOf(controls, "sprint"), "sprint"],
    [keysOf(controls, "jump"), "skok"],
    [keysOf(controls, "crouch"), "kucanie"],
    [pair("fire", "aim"), "strzał / celowanie"],
    [keysOf(controls, "reload"), "przeładowanie"],
    [keysOf(controls, "interact"), "interakcja"],
    [pair("nextWeapon", "prevWeapon"), "zmiana broni"],
    [keysOf(controls, "toggleCamera"), "FPP / TPP"],
    [keysOf(controls, "ability"), "zdolność cyberware"],
    [keysOf(controls, "useItem"), "apteczka"],
  ];
};

const FIXED: readonly [string, string][] = [
  ["Mysz", "rozglądanie"],
  ["I / Tab / J / M", "ekwipunek / karta / dziennik / mapa"],
  ["F5 / F9", "szybki zapis / odczyt"],
  ["Esc / P", "pauza"],
];

export const ControlsHelp = () => {
  const controls = useUi((s) => s.controls);
  const rows = [...(controls.length > 0 ? fromBindings(controls) : FALLBACK), ...FIXED];
  return (
    <dl className="controls">
      {rows.map(([k, v]) => (
        <div key={v} className="controls__row">
          <dt>
            <kbd>{k}</kbd>
          </dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
};
