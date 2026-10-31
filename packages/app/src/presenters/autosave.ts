import type { AudioPort } from "@seki/core";
import { type UiStore, translate } from "@seki/ui";
import type { AutosaveView } from "../controllers/autosave-controller";
import { pushToastTimed } from "../controllers/shared";

/**
 * The autosave on screen: one short toast per save, in the language of the moment (ADR-0056),
 * with the save click. A failure says why, so a full or blocked storage does not go unnoticed.
 */
export const autosaveView = (ui: UiStore, audio: AudioPort): AutosaveView => {
  const t = (key: "save.autosaved" | "save.failed") => translate(ui.getState().settings.locale, key);
  return {
    saved() {
      audio.play("save");
      pushToastTimed(ui, "system", t("save.autosaved"));
    },
    failed(error) {
      pushToastTimed(ui, "system", t("save.failed"), String(error));
    },
  };
};
