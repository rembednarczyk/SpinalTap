import { useState } from "react";
import { useIntents } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";

export const PauseMenu = () => {
  const intents = useIntents();
  const [tab, setTab] = useState<"main" | "save" | "load">("main");
  return (
    <div className="screen screen--pause" data-testid="pause-menu">
      <h2 className="screen__heading">Pauza</h2>
      {tab === "main" && (
        <div className="menu">
          <button type="button" className="menu__item" onClick={() => intents.resume()}>
            Wróć do gry
          </button>
          <button type="button" className="menu__item" onClick={() => setTab("save")}>
            Zapisz
          </button>
          <button type="button" className="menu__item" onClick={() => setTab("load")}>
            Wczytaj
          </button>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
            Menu główne
          </button>
          <ControlsHelp />
        </div>
      )}
      {tab !== "main" && (
        <div className="menu">
          <SaveSlots mode={tab} />
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setTab("main")}>
            Wróć
          </button>
        </div>
      )}
    </div>
  );
};
