import { useState } from "react";
import { CreditsScreen } from "../credits/credits-screen";
import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";

/** Phones: more room and landscape lock where the browser allows it. Optional everywhere. */
const FullscreenButton = () => {
  const t = useT();
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!coarse || !document.fullscreenEnabled) return null;
  const go = async () => {
    try {
      await document.documentElement.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.("landscape");
    } catch {
      // Not allowed here (iOS Safari, embedded frames): play in the browser window.
    }
  };
  return (
    <button type="button" className="menu__item menu__item--ghost" onClick={() => void go()}>
      {t("title.fullscreen")}
    </button>
  );
};

export const TitleScreen = () => {
  const intents = useSessionIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  const busy = useUi((s) => s.busy);
  const t = useT();
  const [view, setView] = useState<"main" | "load" | "credits">("main");
  return (
    <div className="screen screen--title" data-testid="title-screen">
      <div className="title">
        <div className="title__kanji">関 戦士</div>
        <h1 className="title__name">SEKI SENSHI</h1>
        <div className="title__tag">{t("title.tagline")}</div>
      </div>
      {view === "main" ? (
        <div className="menu">
          <button type="button" className="menu__item" disabled={busy} onClick={() => intents.newGame()}>
            {t("title.newGame")}
          </button>
          <button type="button" className="menu__item" disabled={!hasSaves || busy} onClick={() => setView("load")}>
            {t("title.load")}
          </button>
          <FullscreenButton />
          <ControlsHelp />
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setView("credits")}>
            {t("title.credits")}
          </button>
        </div>
      ) : view === "credits" ? (
        <CreditsScreen intents={{ closeCredits: () => setView("main") }} />
      ) : (
        <div className="menu">
          <SaveSlots mode="load" />
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setView("main")}>
            {t("menu.back")}
          </button>
        </div>
      )}
      <div className="title__attribution" data-testid="title-attribution">
        {t("title.attribution")}
      </div>
    </div>
  );
};
