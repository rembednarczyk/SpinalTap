import { useEffect } from "react";
import { isMessageKey } from "../i18n/t";
import { useT } from "../i18n/use-t";
import type { EndScreenIntents } from "../intents";
import type { EndScreenVm } from "../store/end-screen-vm";
import { useEndScreenIntents, useUi } from "../use-ui";
import "./end-screen.css";

/** Esc and Enter go back to the city, as the button does. */
const useCloseKeys = (open: boolean, intents: EndScreenIntents) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
      // A focused button would click on Enter too, and close twice.
      e.preventDefault();
      intents.closeEndScreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, intents]);
};

const EndScreenCard = ({ vm, intents }: { vm: EndScreenVm; intents: EndScreenIntents }) => {
  const t = useT();
  const say = (key: string) => (isMessageKey(key) ? t(key) : key);
  return (
    <div className="screen screen--end" data-testid="end-screen" role="dialog" aria-modal="true" aria-labelledby="end-heading">
      <div className="end">
        <h2 id="end-heading" className="end__heading">
          {t("endScreen.heading")}
        </h2>
        <ol className="end__acts">
          {vm.acts.map((a) => (
            <li key={a.act} className="end__act">
              <span className="end__act-name">{say(a.act)}</span>
              <span className="end__act-ending">{say(a.ending)}</span>
            </li>
          ))}
        </ol>
        <h3 className="end__section">{t("endScreen.choices")}</h3>
        <ul className="end__choices" data-testid="end-choices">
          {vm.choices.map((c) => (
            <li key={c}>{say(c)}</li>
          ))}
        </ul>
        <p className="end__stats">
          {t("endScreen.level", { level: vm.level })} · {t("endScreen.contracts", { count: vm.contracts })} · {t("endScreen.memories", { count: vm.memories })}
        </p>
        <p className="end__lead">{t("endScreen.lead")}</p>
        <p className="end__credits">{t("credits.game")}</p>
        <button type="button" className="menu__item" onClick={() => intents.closeEndScreen()}>
          {t("endScreen.back")}
        </button>
      </div>
    </div>
  );
};

/**
 * The end screen after the main thread's epilogue (ADR-0095 stage 2): how each act ended, the
 * choices that led there, a few numbers of the run and a line of credits. Shown once; the button
 * goes back to the city, where the game goes on.
 */
export const EndScreen = () => {
  const vm = useUi((s) => s.endScreen);
  const intents = useEndScreenIntents();
  useCloseKeys(vm !== null, intents);
  if (!vm) return null;
  return <EndScreenCard vm={vm} intents={intents} />;
};
