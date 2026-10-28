import type { AudioPort, PersistencePort, RenderPort } from "@seki/core";
import type { UiStore } from "@seki/ui";
import type { PreviewHost } from "./character-view";
import type { HintsHost } from "./controllers/hint-sync";
import type { SettingsHost } from "./controllers/settings-controller";

export type { HintsHost } from "./controllers/hint-sync";
export type { SettingsHost } from "./controllers/settings-controller";

/** Ports and hosts of a game session; the browser fills them in `main.tsx`, tests with fakes. */
export interface GameSessionDeps {
  readonly render: RenderPort;
  readonly audio: AudioPort;
  readonly persistence: PersistencePort;
  readonly ui: UiStore;
  readonly story: string;
  /** Seed for a new game. Injected so tests and reference mode are reproducible. */
  readonly seed: () => number;
  readonly now: () => Date;
  /** Called after every screen or dialogue change, e.g. to grab or release the pointer. */
  readonly onFocusChange?: (wantsPointer: boolean) => void;
  /** Where settings live (localStorage in the browser). Without it changes last for the session only. */
  readonly settings?: SettingsHost;
  /** 3D preview of the character menu (the engine's PreviewStage in the browser). */
  readonly preview?: PreviewHost;
  /** First-run hints already seen, and where to keep them (localStorage in the browser). */
  readonly hints?: HintsHost;
  /** Touch controls on screen: hints use touch words instead of keys. */
  readonly touch?: boolean;
}
