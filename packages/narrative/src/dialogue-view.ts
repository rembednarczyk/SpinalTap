export interface DialogueLine {
  /** Display name, or null for narration. */
  readonly speaker: string | null;
  readonly text: string;
}

/**
 * What kind of option a choice is (ADR-0039), from the ink tag `# tone:<kind>` inside the
 * choice brackets. The UI gives each kind a colour and an icon, as in Cyberpunk 2077: `main`
 * moves the scene on, `optional` asks around, `leave` ends the talk, `aggressive` threatens,
 * `persuade` talks someone round, `hack` jacks into something, `lifepath` exists because of a
 * memory or an earlier story choice.
 */
export const DIALOGUE_TONES = ["main", "optional", "leave", "aggressive", "persuade", "hack", "lifepath"] as const;
export type DialogueTone = (typeof DIALOGUE_TONES)[number];
export const DEFAULT_TONE: DialogueTone = "optional";

export const isDialogueTone = (s: string): s is DialogueTone => (DIALOGUE_TONES as readonly string[]).includes(s);

const TONE_TAG = /^tone\s*:\s*(\S+)$/;

/** The tone among a choice's ink tags; `optional` without a (known) one. */
export const toneOf = (tags: readonly string[] | null | undefined): DialogueTone => {
  for (const tag of tags ?? []) {
    const m = TONE_TAG.exec(tag.trim());
    if (m?.[1] !== undefined && isDialogueTone(m[1])) return m[1];
  }
  return DEFAULT_TONE;
};

export interface DialogueChoice {
  readonly index: number;
  readonly text: string;
  readonly tone: DialogueTone;
}

/** Engine- and UI-agnostic snapshot of a conversation, ready to render. */
export interface DialogueView {
  readonly dialogueId: string;
  readonly lines: readonly DialogueLine[];
  readonly choices: readonly DialogueChoice[];
  readonly ended: boolean;
}
