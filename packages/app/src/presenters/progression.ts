import { patchUi } from "@seki/ui";
import type { Presenter } from "./context";
import { uiText } from "./trade";

/**
 * Character progression (ADR-0059, stages 1 and 3b): the level-up toast and the respec's, in
 * the language of the moment they appear (ADR-0056). A new level replaces the toast of the one
 * before, so a big reward that gives several levels at once takes one place in the stack. The XP
 * bar, the points' marks and the Progress tab (stage 7) read the HUD sync's `xp`, `level` and points;
 * the bar's moment on screen and its flash follow the XP and levels earned, counted here.
 */
export const presentProgression: Presenter = ({ bus, audio, toast, dismiss, ui }) => {
  let shown: number | null = null;
  return [
    // Only what is earned in play shows the HUD's bar: a load or a new game sets XP without these.
    bus.on("ExperienceGained", () => patchUi(ui, { xpGains: ui.getState().xpGains + 1 })),
    bus.on("LevelUp", (e) => {
      patchUi(ui, { levelUps: ui.getState().levelUps + 1 });
      const t = uiText(ui);
      if (shown !== null) dismiss(shown);
      shown = toast("system", t("progress.levelUp", { level: e.level }), t("progress.levelUpPoints"), true);
      audio.play("quest-update");
    }),
    bus.on("ProgressionReset", (e) => {
      const t = uiText(ui);
      toast("system", t("respec.done"), t("respec.donePoints", { attribute: e.attribute, perk: e.perk }));
    }),
  ];
};
