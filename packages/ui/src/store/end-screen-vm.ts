/**
 * The end screen after the main thread's epilogue (ADR-0095 stage 2): the ending of each act and
 * the choices that led there, as catalog keys the screen writes in the player's language, and a few
 * numbers of the run. Written by the app's end screen controller.
 */
export interface EndScreenVm {
  /** Per act: its catalog key (`endScreen.act1`) and its ending's title key (`ending.<id>.title`). */
  readonly acts: readonly { readonly act: string; readonly ending: string }[];
  /** The main thread's choices in story order, each a catalog key (`story.choice.<choice>.<option>`). */
  readonly choices: readonly string[];
  readonly level: number;
  readonly contracts: number;
  readonly memories: number;
}

export interface EndScreenUiState {
  /** The end screen, null when it is not shown. */
  readonly endScreen: EndScreenVm | null;
}

export const NO_END_SCREEN: EndScreenUiState = { endScreen: null };
