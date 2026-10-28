import { useState } from "react";
import { useSessionIntents } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";
import { SettingsPanel } from "./settings-panel";

export const PauseMenu = () => {
  const intents = useSessionIntents();
  const [tab, setTab] = useState<"main" | "save" | "load" | "settings">("main");
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
          <button type="button" className="menu__item" onClick={() => setTab("settings")}>
            Ustawienia
          </button>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
            Menu główne
          </button>
          <ControlsHelp />
        </div>
      )}
      {tab !== "main" && (
        <div className="menu">
          {tab === "settings" ? <SettingsPanel /> : <SaveSlots mode={tab} />}
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setTab("main")}>
            Wróć
          </button>
        </div>
      )}
    </div>
  );
};
