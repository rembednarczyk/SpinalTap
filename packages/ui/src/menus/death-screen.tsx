import { useIntents, useUi } from "../use-ui";
import { SaveSlots } from "./save-slots";

export const DeathScreen = () => {
  const intents = useIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  return (
    <div className="screen screen--dead" data-testid="death-screen">
      <h2 className="screen__heading screen__heading--flatline">FLATLINE</h2>
      <p className="screen__sub">Sygnały życiowe: brak. Ktoś inny zapamięta, jak się nazywałaś.</p>
      <div className="menu">
        {hasSaves && <SaveSlots mode="load" />}
        <button type="button" className="menu__item" onClick={() => intents.newGame()}>
          Zacznij od nowa
        </button>
        <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
          Menu główne
        </button>
      </div>
    </div>
  );
};
