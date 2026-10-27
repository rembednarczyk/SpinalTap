import { useEffect, useMemo } from "react";
import { DialoguePanel } from "./dialogue/dialogue-panel";
import { Hud } from "./hud/hud";
import { CharacterPanel } from "./menus/character-panel";
import { JournalPanel } from "./journal/journal-panel";
import { ShopPanel } from "./shop/shop-panel";
import { TouchControls } from "./touch/touch-controls";
import type { TouchPadSink } from "./touch/touch-pad-sink";
import type { UiIntents } from "./intents";
import { DeathScreen } from "./menus/death-screen";
import { PauseMenu } from "./menus/pause-menu";
import { TitleScreen } from "./menus/title-screen";
import type { UiStore } from "./store/ui-store";
import { UiContext, useUi } from "./use-ui";

const Screens = ({ touch }: { touch: TouchPadSink | undefined }) => {
  const screen = useUi((s) => s.screen);
  const modal = useUi((s) => s.dialogue !== null || s.shopOpen);
  return (
    <>
      {touch && screen === "playing" && !modal && <TouchControls pad={touch} />}
      {touch && <div className="rotate-hint">Obróć telefon poziomo</div>}
      {screen !== "title" && <Hud />}
      {screen === "playing" && <DialoguePanel />}
      {screen === "playing" && <ShopPanel />}
      {screen === "playing" && <CharacterPanel />}
      {screen === "playing" && <JournalPanel />}
      {screen === "title" && <TitleScreen />}
      {screen === "paused" && <PauseMenu />}
      {screen === "dead" && <DeathScreen />}
    </>
  );
};

/** Root of the React overlay. Reads only the store; acts only through intents. */
export const GameUi = ({ store, intents, touch }: { store: UiStore; intents: UiIntents; touch?: TouchPadSink }) => {
  const value = useMemo(() => ({ store, intents }), [store, intents]);
  useEffect(() => {
    document.documentElement.classList.toggle("touch-mode", !!touch);
  }, [touch]);
  return (
    <UiContext.Provider value={value}>
      <Screens touch={touch} />
    </UiContext.Provider>
  );
};
