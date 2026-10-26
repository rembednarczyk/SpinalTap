import { useState } from "react";
import { useIntents, useUi } from "../use-ui";
import { ControlsHelp } from "./controls-help";
import { SaveSlots } from "./save-slots";

/** Phones: more room and landscape lock where the browser allows it. Optional everywhere. */
const FullscreenButton = () => {
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
      Pełny ekran
    </button>
  );
};

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
        <div className="title__tag">Shinsekai · kwartał 7 · M1</div>
      </div>
      {view === "main" ? (
        <div className="menu">
          <button type="button" className="menu__item" disabled={busy} onClick={() => intents.newGame()}>
            Nowa gra
          </button>
          <button type="button" className="menu__item" disabled={!hasSaves || busy} onClick={() => setView("load")}>
            Wczytaj
          </button>
          <FullscreenButton />
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
