import type { Locale } from "@seki/core";
import { GRAB_PROMPT } from "@seki/sim";
import { patchUi } from "@seki/ui";
import { contentText } from "../content-text";
import type { Presenter } from "./context";

/** What the attack button does with the prompt's target, per prompt key: the grab's kill (ADR-0075). */
const HOLD_TEXT: Readonly<Record<string, string>> = { [GRAB_PROMPT]: "prompt.grab.kill" };

/** The prompt and its attack-button action in `locale`, for the UI store. */
const promptState = (locale: Locale, key: string | null) => {
  const hold = key === null ? undefined : HOLD_TEXT[key];
  return { prompt: key === null ? null : contentText(locale, key), promptHold: hold ? contentText(locale, hold) : null };
};

/**
 * The interaction prompt (ADR-0056): the simulation names it by key, the HUD gets it in the
 * player's language, and a language change rewrites the prompt on screen at once. A grab's
 * prompt (ADR-0075) comes with its second action: the interact key knocks out, the attack button kills.
 */
export const presentPrompt: Presenter = ({ bus, ui }) => {
  let key: string | null = null;
  let shownIn: Locale = ui.getState().settings.locale;
  return [
    bus.on("InteractionFocusChanged", (e) => {
      key = e.prompt;
      shownIn = ui.getState().settings.locale;
      patchUi(ui, promptState(shownIn, key));
    }),
    ui.subscribe((s) => {
      if (s.settings.locale === shownIn) return;
      shownIn = s.settings.locale;
      // A panel hid the prompt (prompt: null): it stays hidden until the next focus.
      if (key !== null && s.prompt !== null) patchUi(ui, promptState(shownIn, key));
    }),
  ];
};
