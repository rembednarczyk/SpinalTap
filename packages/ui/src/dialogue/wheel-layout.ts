import type { MessageKey } from "../i18n/t";
import type { DialogueChoiceVm, DialogueToneVm, DialogueVm } from "../store/ui-vm";

/**
 * The dialogue wheel (ADR-0039) as plain data: which slots there are, in what order, and where
 * each one sits on the arc. The component only renders this; the tests read it directly.
 */

/**
 * Colour comes from CSS (`.wheel__opt--<tone>`); the icon and the label make sure colour is never
 * alone. The label is a catalog key (ADR-0056).
 */
export const TONE_STYLE: Readonly<Record<DialogueToneVm, { readonly icon: string; readonly label: MessageKey }>> = {
  main: { icon: "◆", label: "dialogue.tone.main" },
  optional: { icon: "◇", label: "dialogue.tone.optional" },
  leave: { icon: "✕", label: "dialogue.tone.leave" },
  aggressive: { icon: "▲", label: "dialogue.tone.aggressive" },
  persuade: { icon: "◎", label: "dialogue.tone.persuade" },
  hack: { icon: "⬡", label: "dialogue.tone.hack" },
  lifepath: { icon: "✦", label: "dialogue.tone.lifepath" },
};

export type SlotAction = { readonly kind: "choose"; readonly index: number } | { readonly kind: "close" };

export interface WheelSlot {
  readonly key: string;
  readonly text: string;
  readonly tone: DialogueToneVm;
  /** Key hint on the slot: its number, or E for the end of the talk. */
  readonly hint: string;
  readonly action: SlotAction;
}

const toneOf = (c: DialogueChoiceVm): DialogueToneVm => c.tone ?? "optional";

/**
 * Slots top to bottom: the choices in ink order, the ones that end the talk last, so the way
 * out always sits at the bottom of the arc. An ended talk has a single slot, the way out, with
 * `endText` on it (the interface's own words; the choices are the ink's).
 */
export const wheelSlots = (dialogue: DialogueVm, endText: string): readonly WheelSlot[] => {
  if (dialogue.ended) return [{ key: "end", text: endText, tone: "leave", hint: "E", action: { kind: "close" } }];
  const stay = dialogue.choices.filter((c) => toneOf(c) !== "leave");
  const leave = dialogue.choices.filter((c) => toneOf(c) === "leave");
  return [...stay, ...leave].map((c, i) => ({
    key: `c${c.index}`,
    text: c.text,
    tone: toneOf(c),
    hint: String(i + 1),
    action: { kind: "choose", index: c.index },
  }));
};

export interface ArcPoint {
  /** Distance right of the hub, in slot steps (CSS multiplies by `--step`). */
  readonly x: number;
  /** Distance below the hub, in slot steps. */
  readonly y: number;
  /** Direction from the hub, degrees, 0 to the right, positive downwards. */
  readonly angle: number;
}

/** The arc never opens wider than this: sin of the top and bottom slot angles (about 58°). */
const ARC_SPREAD = 0.85;
/** Radius in steps for one or two slots, so a short arc still curves around the hub. */
const MIN_RADIUS = 2.6;

/**
 * Points on a circle round the hub, one slot step apart vertically, centred on the hub. A
 * single slot sits level with it. No empty slots: the arc is as long as the list.
 */
export const arcLayout = (count: number): readonly ArcPoint[] => {
  const half = (count - 1) / 2;
  const radius = Math.max(MIN_RADIUS, half / ARC_SPREAD);
  return Array.from({ length: count }, (_, i) => {
    const y = i - half;
    const x = Math.sqrt(radius * radius - y * y);
    return { x, y, angle: (Math.atan2(y, x) * 180) / Math.PI };
  });
};

/**
 * The slot a direction points at (a pad stick, ADR-0039): the nearest by angle, or null when
 * the stick points left, away from the arc. `angle` uses the same convention as `ArcPoint`.
 */
export const slotAtAngle = (points: readonly ArcPoint[], angle: number): number | null => {
  if (points.length === 0 || Math.abs(angle) > 120) return null;
  let best = 0;
  points.forEach((p, i) => {
    if (Math.abs(p.angle - angle) < Math.abs((points[best]?.angle ?? 0) - angle)) best = i;
  });
  return best;
};

/** One step up or down the arc, wrapping round at the ends. */
export const stepSlot = (current: number, delta: number, count: number): number => (count === 0 ? 0 : (((current + delta) % count) + count) % count);
