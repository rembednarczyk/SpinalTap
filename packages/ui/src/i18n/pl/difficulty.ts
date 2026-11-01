import type { DifficultyKey } from "../en/difficulty";
import type { Message } from "../message";

/** Polish texts of the difficulty (ADR-0066, stage 2): the English keys. */
export const plDifficulty = {
  "difficulty.heading": "Poziom trudności",
  "difficulty.preset.story": "Opowieść",
  "difficulty.preset.normal": "Normalny",
  "difficulty.preset.hard": "Trudny",
  "difficulty.preset.custom": "Własny",
  "difficulty.desc.story": "Dla fabuły: wrogowie biją słabiej, później cię zauważają i szybciej padają.",
  "difficulty.desc.normal": "Gra wyważona tak, jak ma się w nią grać.",
  "difficulty.desc.hard": "Te same zasady i ostrzejsze liczby: wrogowie biją mocniej, celniej strzelają i szybciej cię zauważają.",
  "difficulty.desc.custom": "Twój zestaw mnożników z suwaków poniżej.",
  "difficulty.custom": "Własne ustawienia",
  "difficulty.field.damageTaken": "Otrzymywane obrażenia",
  "difficulty.field.npcAccuracy": "Celność wrogów",
  "difficulty.field.awareness": "Czujność wrogów",
  "difficulty.field.reinforce": "Posiłki",
  "difficulty.field.npcHealth": "Zdrowie wrogów",
  "difficulty.field.snipeTell": "Ostrzeżenie snajpera",
  "difficulty.pending": "Zmieni się po walce.",
  "difficulty.slot": "Poziom trudności: {preset}",
  "newGame.heading": "Nowa gra",
  "newGame.start": "Rozpocznij",
  "pause.difficulty": "Poziom trudności",
} as const satisfies Readonly<Record<DifficultyKey, Message>>;
