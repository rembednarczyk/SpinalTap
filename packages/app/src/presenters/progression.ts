import type { Presenter } from "./context";
import { uiText } from "./trade";

/**
 * Character progression (ADR-0059, stage 1): the level-up toast, in the language of the moment
 * it appears (ADR-0056). The XP bar and the Progress tab come in stage 7.
 */
export const presentProgression: Presenter = ({ bus, audio, toast, ui }) => [
  bus.on("LevelUp", (e) => {
    const t = uiText(ui);
    toast("system", t("progress.levelUp", { level: e.level }), t("progress.levelUpPoints"));
    audio.play("quest-update");
  }),
];
