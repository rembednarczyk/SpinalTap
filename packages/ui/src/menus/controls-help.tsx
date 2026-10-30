import type { MessageKey } from "../i18n/en";
import type { Translate } from "../i18n/t";
import { useT } from "../i18n/use-t";
import type { ControlBindingVm } from "../store/ui-store";
import { useUi } from "../use-ui";
import { keyLabel } from "./key-label";

type Row = readonly [keys: string, what: MessageKey];

/** Keys before the player's bindings arrive (and in tests): the defaults. */
const fallback = (t: Translate): Row[] => [
  ["WASD", "help.move"],
  ["Shift", "help.sprint"],
  [keyLabel("Space", t), "help.jump"],
  ["C", "help.crouch"],
  [`${keyLabel("Mouse0", t)} / ${keyLabel("Mouse2", t)}`, "help.fireAim"],
  ["R", "help.reload"],
  ["E / F", "help.interact"],
  [t("key.wheel"), "help.switchWeapon"],
];

const keysOf = (controls: readonly ControlBindingVm[], action: string, t: Translate): string =>
  (controls.find((c) => c.action === action)?.codes ?? []).map((code) => keyLabel(code, t)).join(" / ");

/** The controls that matter in play, from the current bindings, then the fixed menu keys. */
const fromBindings = (controls: readonly ControlBindingVm[], t: Translate): Row[] => {
  const keys = (a: string) => keysOf(controls, a, t);
  const move = ["forward", "left", "back", "right"].map((a) => keys(a).split(" / ")[0] ?? "").join("");
  const pair = (a: string, b: string) => [keys(a), keys(b)].filter(Boolean).join(" / ");
  return [
    [move, "help.move"],
    [keys("sprint"), "help.sprint"],
    [keys("jump"), "help.jump"],
    [keys("crouch"), "help.crouch"],
    [pair("fire", "aim"), "help.fireAim"],
    [keys("reload"), "help.reload"],
    [keys("interact"), "help.interact"],
    [pair("nextWeapon", "prevWeapon"), "help.switchWeapon"],
    [keys("toggleCamera"), "help.camera"],
    [keys("ability"), "help.ability"],
    [keys("useItem"), "help.medkit"],
  ];
};

const fixed = (t: Translate): Row[] => [
  [t("key.mouse"), "help.look"],
  ["I / Tab / J / M", "help.panels"],
  ["F5 / F9", "help.quickSave"],
  ["Esc / P", "help.pause"],
];

export const ControlsHelp = () => {
  const controls = useUi((s) => s.controls);
  const t = useT();
  const rows = [...(controls.length > 0 ? fromBindings(controls, t) : fallback(t)), ...fixed(t)];
  return (
    <dl className="controls">
      {rows.map(([k, v]) => (
        <div key={v} className="controls__row">
          <dt>
            <kbd>{k}</kbd>
          </dt>
          <dd>{t(v)}</dd>
        </div>
      ))}
    </dl>
  );
};
