const NAMED: Readonly<Record<string, string>> = {
  Space: "Spacja",
  ShiftLeft: "Shift",
  ShiftRight: "Prawy Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Prawy Ctrl",
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
  Mouse0: "LPM",
  Mouse1: "ŚPM",
  Mouse2: "PPM",
  Mouse3: "Mysz 4",
  Mouse4: "Mysz 5",
  WheelUp: "Kółko ↑",
  WheelDown: "Kółko ↓",
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

/** A physical code as a player reads it: "KeyW" -> "W", "Mouse2" -> "PPM", "Numpad1" -> "Num 1". */
export const keyLabel = (code: string): string => {
  const named = NAMED[code];
  if (named) return named;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
};

/** Keys the game keeps for itself (menus, saves, pause); they cannot be bound to a control. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(["Escape", "F5", "F9", "KeyP", "KeyI", "Tab", "KeyJ"]);
