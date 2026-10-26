import { useState } from "react";
import { useIntents, useUi } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";

export const TitleScreen = () => {
  const intents = useIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  const busy = useUi((s) => s.busy);
  const [view, setView] = useState<"main" | "load">("main");
  return (
    <div className="screen screen--title" data-testid="title-screen">
      <div className="title">
        <div className="title__kanji">関 戦士</div>
        <h1 className="title__name">SEKI SENSHI</h1>
        <div className="title__tag">Shinsekai · kwartał 7 · wycinek M0</div>
      </div>
      {view === "main" ? (
        <div className="menu">
          <button type="button" className="menu__item" disabled={busy} onClick={() => intents.newGame()}>
            Nowa gra
          </button>
          <button type="button" className="menu__item" disabled={!hasSaves || busy} onClick={() => setView("load")}>
            Wczytaj
          </button>
          <ControlsHelp />
        </div>
      ) : (
        <div className="menu">
          <SaveSlots mode="load" />
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setView("main")}>
            Wróć
          </button>
        </div>
      )}
    </div>
  );
};
