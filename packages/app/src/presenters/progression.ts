import type { Presenter } from "./context";
import { uiText } from "./trade";

/**
 * Character progression (ADR-0059, stage 1): the level-up toast, in the language of the moment
 * it appears (ADR-0056). A new level replaces the toast of the one before, so a big reward that
 * gives several levels at once takes one place in the stack. The XP bar and the Progress tab
 * come in stage 7.
 */
export const presentProgression: Presenter = ({ bus, audio, toast, dismiss, ui }) => {
  let shown: number | null = null;
  return [
    bus.on("LevelUp", (e) => {
      const t = uiText(ui);
      if (shown !== null) dismiss(shown);
      shown = toast("system", t("progress.levelUp", { level: e.level }), t("progress.levelUpPoints"));
      audio.play("quest-update");
    }),
  ];
};
