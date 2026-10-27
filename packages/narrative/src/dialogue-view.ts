export interface DialogueLine {
  /** Display name, or null for narration. */
  readonly speaker: string | null;
  readonly text: string;
}

export interface DialogueChoice {
  readonly index: number;
  readonly text: string;
}

/** Engine- and UI-agnostic snapshot of a conversation, ready to render. */
export interface DialogueView {
  readonly dialogueId: string;
  readonly lines: readonly DialogueLine[];
  readonly choices: readonly DialogueChoice[];
  readonly ended: boolean;
}
