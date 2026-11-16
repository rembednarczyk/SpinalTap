import type { Message } from "../message";

/** English texts of waiting: the pause menu's entry, its key, the window and why it is off. */
export const enWait = {
  "pause.wait": "Wait",
  "control.wait": "Wait",
  "help.wait": "wait",
  "wait.heading": "Wait",
  "wait.hours": { one: "{count} hour", other: "{count} hours" },
  "wait.slider": "Hours to wait",
  "wait.less": "One hour less",
  "wait.more": "One hour more",
  "wait.now": "Now {time}, day {day}",
  "wait.until": "You will be done at {time}, day {day}",
  "wait.confirm": "Wait",
  "wait.cancel": "Cancel",
  "wait.keys": "← → hours · Enter waits · Esc closes",
  "wait.blockedTitle": "You cannot wait now",
  "wait.blocked.combat": "Not in a fight.",
  "wait.blocked.alarm": "Not with the alarm raised.",
  "wait.blocked.wanted": "Not while you are hunted.",
  "wait.blocked.busy": "Not now.",
} as const satisfies Readonly<Record<string, Message>>;

export type WaitKey = keyof typeof enWait;
