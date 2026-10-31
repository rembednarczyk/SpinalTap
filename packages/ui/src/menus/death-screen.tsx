import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";
import { SaveSlots } from "./save-slots";

export const DeathScreen = () => {
  const intents = useSessionIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  const t = useT();
  return (
    <div className="screen screen--dead" data-testid="death-screen">
      <h2 className="screen__heading screen__heading--flatline">FLATLINE</h2>
      <p className="screen__sub">{t("death.lines")}</p>
      <div className="menu">
        {hasSaves && <SaveSlots mode="load" />}
        <button type="button" className="menu__item" onClick={() => intents.newGame()}>
          {t("death.restart")}
        </button>
        <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
          {t("death.title")}
        </button>
      </div>
    </div>
  );
};
