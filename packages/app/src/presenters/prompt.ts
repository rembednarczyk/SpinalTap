import type { Locale } from "@seki/core";
import { patchUi } from "@seki/ui";
import { contentText } from "../content-text";
import type { Presenter } from "./context";

/**
 * The interaction prompt (ADR-0056): the simulation names it by key, the HUD gets it in the
 * player's language, and a language change rewrites the prompt on screen at once.
 */
export const presentPrompt: Presenter = ({ bus, ui }) => {
  let key: string | null = null;
  let shownIn: Locale = ui.getState().settings.locale;
  return [
    bus.on("InteractionFocusChanged", (e) => {
      key = e.prompt;
      shownIn = ui.getState().settings.locale;
      patchUi(ui, { prompt: key === null ? null : contentText(shownIn, key) });
    }),
    ui.subscribe((s) => {
      if (s.settings.locale === shownIn) return;
      shownIn = s.settings.locale;
      // A panel hid the prompt (prompt: null): it stays hidden until the next focus.
      if (key !== null && s.prompt !== null) patchUi(ui, { prompt: contentText(shownIn, key) });
    }),
  ];
};
