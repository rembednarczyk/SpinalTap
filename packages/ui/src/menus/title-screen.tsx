import { useState } from "react";
import { MAP_ATTRIBUTION } from "../store/map-vm";
import { useSessionIntents, useUi } from "../use-ui";
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

/** Who made what the game is drawn from (ADR-0045): the map of Lublin and its terrain. */
const Credits = ({ back }: { back: () => void }) => (
  <div className="menu credits" data-testid="credits">
    <h2 className="credits__title">Autorzy i źródła</h2>
    <p className="credits__line">Seki Senshi: gra w przeglądarce, Lublin 2077.</p>
    <p className="credits__line">
      Ulice, budynki i nazwy: © OpenStreetMap contributors, dane na licencji Open Database License (ODbL), openstreetmap.org/copyright.
    </p>
    <p className="credits__line">Ukształtowanie terenu: numeryczny model terenu GUGiK (geoportal.gov.pl).</p>
    <p className="credits__line">Miasto w grze jest zmyślone: ludzie, firmy i zdarzenia nie mają nic wspólnego z prawdziwym Lublinem.</p>
    <button type="button" className="menu__item menu__item--ghost" onClick={back}>
      Wróć
    </button>
  </div>
);

export const TitleScreen = () => {
  const intents = useSessionIntents();
  const hasSaves = useUi((s) => s.hasSaves);
  const busy = useUi((s) => s.busy);
  const [view, setView] = useState<"main" | "load" | "credits">("main");
  return (
    <div className="screen screen--title" data-testid="title-screen">
      <div className="title">
        <div className="title__kanji">関 戦士</div>
        <h1 className="title__name">SEKI SENSHI</h1>
        <div className="title__tag">Lublin · Krakowskie Przedmieście</div>
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
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setView("credits")}>
            Autorzy
          </button>
        </div>
      ) : view === "credits" ? (
        <Credits back={() => setView("main")} />
      ) : (
        <div className="menu">
          <SaveSlots mode="load" />
          <button type="button" className="menu__item menu__item--ghost" onClick={() => setView("main")}>
            Wróć
          </button>
        </div>
      )}
      <div className="title__attribution" data-testid="title-attribution">
        {MAP_ATTRIBUTION}
      </div>
    </div>
  );
};
