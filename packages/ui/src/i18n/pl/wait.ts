import type { WaitKey } from "../en/wait";
import type { Message } from "../message";

/** Polish texts of waiting: the English keys. */
export const plWait = {
  "pause.wait": "Czekaj",
  "control.wait": "Czekanie",
  "help.wait": "czekanie",
  "wait.heading": "Czekanie",
  "wait.hours": { one: "{count} godzina", few: "{count} godziny", many: "{count} godzin", other: "{count} godziny" },
  "wait.slider": "Ile godzin czekać",
  "wait.less": "Godzina mniej",
  "wait.more": "Godzina więcej",
  "wait.now": "Teraz {time}, dzień {day}",
  "wait.until": "Skończysz o {time}, dzień {day}",
  "wait.confirm": "Czekaj",
  "wait.cancel": "Anuluj",
  "wait.keys": "← → godziny · Enter czeka · Esc zamyka",
  "wait.blockedTitle": "Nie możesz teraz czekać",
  "wait.blocked.combat": "Nie w czasie walki.",
  "wait.blocked.alarm": "Nie przy podniesionym alarmie.",
  "wait.blocked.wanted": "Nie, gdy cię ścigają.",
  "wait.blocked.busy": "Nie teraz.",
} as const satisfies Readonly<Record<WaitKey, Message>>;
