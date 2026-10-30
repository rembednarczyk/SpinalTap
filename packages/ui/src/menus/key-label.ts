import type { MessageKey } from "../i18n/en";
import { type Translate, translator } from "../i18n/t";

/** Keys whose name depends on the language (ADR-0056). */
const LOCALIZED: Readonly<Record<string, MessageKey>> = {
  Space: "key.space",
  ShiftRight: "key.rightShift",
  ControlRight: "key.rightCtrl",
  Mouse0: "key.mouse0",
  Mouse1: "key.mouse1",
  Mouse2: "key.mouse2",
  Mouse3: "key.mouse3",
  Mouse4: "key.mouse4",
  WheelUp: "key.wheelUp",
  WheelDown: "key.wheelDown",
  MouseMove: "key.mouse",
};

/** Keys named the same in every language. */
const NAMED: Readonly<Record<string, string>> = {
  ShiftLeft: "Shift",
  ControlLeft: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt Gr",
  Tab: "Tab",
  CapsLock: "Caps Lock",
  Enter: "Enter",
  Backspace: "Backspace",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
};

/** The HUD's key hints are still Polish until stage 2 of ADR-0056 hands them a translator. */
const POLISH = translator("pl");

/**
 * A physical code as a player reads it in the translator's language: "KeyW" -> "W",
 * "Mouse2" -> "RMB", "Numpad1" -> "Num 1".
 */
export const keyLabel = (code: string, t: Translate = POLISH): string => {
  const localized = LOCALIZED[code];
  if (localized) return t(localized);
  const named = NAMED[code];
  if (named) return named;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
};

/** Keys the game keeps for itself (menus, saves, pause, the phone on T, the radio on B); they cannot be bound to a control. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(["Escape", "F5", "F9", "KeyP", "KeyI", "Tab", "KeyJ", "KeyM", "KeyT", "KeyB"]);
