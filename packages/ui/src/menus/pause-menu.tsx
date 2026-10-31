import { useState } from "react";
import { CreditsScreen } from "../credits/credits-screen";
import { useT } from "../i18n/use-t";
import { useSessionIntents } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";
import { SettingsPanel } from "./settings-panel";

export const PauseMenu = () => {
  const intents = useSessionIntents();
  const t = useT();
  const [tab, setTab] = useState<"main" | "save" | "load" | "settings" | "credits">("main");
  return (
    <div className="screen screen--pause" data-testid="pause-menu">
      <h2 className="screen__heading">{t("pause.heading")}</h2>
      {tab === "main" && (
        <div className="menu">
          <button type="button" className="menu__item" onClick={() => intents.resume()}>
            {t("pause.resume")}
          </button>
          <button type="button" className="menu__item" onClick={() => setTab("save")}>
            {t("pause.save")}
          </button>
          <button type="button" className="menu__item" onClick={() => setTab("load")}>
            {t("pause.load")}
          </button>
          <button type="button" className="menu__item" onClick={() => setTab("settings")}>
            {t("pause.settings")}
          </button>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.quitToTitle()}>
            {t("pause.mainMenu")}
          </button>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setTab("credits")}>
            {t("pause.credits")}
          </button>
          <ControlsHelp />
        </div>
      )}
      {tab === "credits" && <CreditsScreen intents={{ closeCredits: () => setTab("main") }} />}
      {tab !== "main" && tab !== "credits" && (
        <div className="menu">
          {tab === "settings" ? <SettingsPanel /> : <SaveSlots mode={tab} />}
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setTab("main")}>
            {t("menu.back")}
          </button>
        </div>
      )}
    </div>
  );
};
