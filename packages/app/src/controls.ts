import { type Action, DEFAULT_KEYMAP, type KeyMap } from "@seki/engine";
import type { ControlBindingVm } from "@seki/ui";

/**
 * The remappable controls in the order the settings list them. The UI names them in the chosen
 * language from its catalogs (ADR-0056); these English names are only its fallback.
 */
export const CONTROL_LABELS: readonly (readonly [Action, string])[] = [
  ["forward", "Move forward"],
  ["back", "Move back"],
  ["left", "Strafe left"],
  ["right", "Strafe right"],
  ["sprint", "Sprint"],
  ["crouch", "Crouch"],
  ["jump", "Jump"],
  ["fire", "Fire / strike"],
  ["aim", "Aim / block"],
  ["reload", "Reload"],
  ["interact", "Interact"],
  ["ability", "Cyberware ability"],
  ["scan", "Scanner (hold)"],
  ["dash", "Dash"],
  ["useItem", "Medkit"],
  ["toggleWeapon", "Holster / draw weapon"],
  ["slot1", "Primary weapon"],
  ["slot2", "Sidearm"],
  ["slot3", "Melee weapon"],
  ["nextWeapon", "Next weapon"],
  ["prevWeapon", "Previous weapon"],
  ["toggleCamera", "FPP / TPP view"],
];

const isAction = (a: string): a is Action => a in DEFAULT_KEYMAP;

/** The engine's key map with the player's bindings over the defaults. */
export const keymapFor = (bindings: Readonly<Record<string, readonly string[]>>): KeyMap => {
  const map: Record<Action, readonly string[]> = { ...DEFAULT_KEYMAP };
  for (const [action, codes] of Object.entries(bindings)) if (isAction(action)) map[action] = codes;
  return map;
};

/** Rows for the settings' key list. */
export const controlsVm = (bindings: Readonly<Record<string, readonly string[]>>): ControlBindingVm[] => {
  const map = keymapFor(bindings);
  return CONTROL_LABELS.map(([action, label]) => ({ action, label, codes: map[action] }));
};

/**
 * Binds `code` to `action` as its only key and takes it off any other action that used it,
 * as PC games do, so one key never does two things. Returns the new overrides.
 */
export const bindKey = (bindings: Readonly<Record<string, readonly string[]>>, action: string, code: string): Record<string, readonly string[]> => {
  if (!isAction(action)) return { ...bindings };
  const map = keymapFor(bindings);
  const next: Record<string, readonly string[]> = {};
  for (const [a] of CONTROL_LABELS) {
    const codes = a === action ? [code] : map[a].filter((c) => c !== code);
    const same = codes.length === DEFAULT_KEYMAP[a].length && codes.every((c, i) => c === DEFAULT_KEYMAP[a][i]);
    if (!same) next[a] = codes;
  }
  return next;
};
