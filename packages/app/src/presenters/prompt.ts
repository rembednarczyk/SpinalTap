import type { Locale } from "@seki/core";
import { TAKEDOWN_PROMPT } from "@seki/sim";
import { patchUi } from "@seki/ui";
import { contentText } from "../content-text";
import type { Presenter } from "./context";

/** What holding the attack button does with the prompt's target, per prompt key (ADR-0065). */
const HOLD_TEXT: Readonly<Record<string, string>> = { [TAKEDOWN_PROMPT]: "prompt.takedown.kill" };

/** The prompt and its hold action in `locale`, for the UI store. */
const promptState = (locale: Locale, key: string | null) => {
  const hold = key === null ? undefined : HOLD_TEXT[key];
  return { prompt: key === null ? null : contentText(locale, key), promptHold: hold ? contentText(locale, hold) : null };
};

/**
 * The interaction prompt (ADR-0056): the simulation names it by key, the HUD gets it in the
 * player's language, and a language change rewrites the prompt on screen at once. A takedown's
 * prompt (ADR-0065) comes with its hold action: holding the attack button kills.
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
