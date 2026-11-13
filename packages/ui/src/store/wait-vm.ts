/** Why the player cannot let the hours pass now: a fight, a raised alarm, a pursuit, or something under way. */
export type WaitBlock = "combat" | "alarm" | "wanted" | "busy";

/** The open wait window: the game clock (seconds since 00:00 of day 1) when it opened. */
export interface WaitVm {
  readonly clockSeconds: number;
}

/** Waiting (let the hours pass). Written by the app's wait controller. */
export interface WaitUiState {
  /** The wait window, null when closed. */
  readonly wait: WaitVm | null;
  /** Why the pause menu's Wait is off; null when waiting is allowed. */
  readonly waitBlocked: WaitBlock | null;
}

export const NO_WAIT: WaitUiState = { wait: null, waitBlocked: null };
