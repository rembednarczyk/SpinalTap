import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";
import { SaveSlots } from "./save-slots";

export const DeathScreen = () => {
  const intents = useSessionIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  // Starting over keeps the difficulty of the run (ADR-0066), the one last asked for.
  const difficulty = useUi((s) => s.difficulty.pending ?? s.difficulty.profile);
  const t = useT();
  return (
    <div className="screen screen--dead" data-testid="death-screen">
      <h2 className="screen__heading screen__heading--flatline">FLATLINE</h2>
      <p className="screen__sub">{t("death.lines")}</p>
      <div className="menu">
        {hasSaves && <SaveSlots mode="load" />}
        <button type="button" className="menu__item" onClick={() => intents.newGame(difficulty)}>
          {t("death.restart")}
        </button>
        <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
          {t("death.title")}
        </button>
      </div>
    </div>
  );
};
