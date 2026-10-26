import { useMemo } from "react";
import { DialoguePanel } from "./dialogue/dialogue-panel";
import { Hud } from "./hud/hud";
import { CharacterPanel } from "./menus/character-panel";
import { ShopPanel } from "./shop/shop-panel";
import type { UiIntents } from "./intents";
import { DeathScreen } from "./menus/death-screen";
import { PauseMenu } from "./menus/pause-menu";
import { TitleScreen } from "./menus/title-screen";
import type { UiStore } from "./store/ui-store";
import { UiContext, useUi } from "./use-ui";

const Screens = () => {
  const screen = useUi((s) => s.screen);
  return (
    <>
      {screen !== "title" && <Hud />}
      {screen === "playing" && <DialoguePanel />}
      {screen === "playing" && <ShopPanel />}
      {screen === "playing" && <CharacterPanel />}
      {screen === "title" && <TitleScreen />}
      {screen === "paused" && <PauseMenu />}
      {screen === "dead" && <DeathScreen />}
    </>
  );
};

/** Root of the React overlay. Reads only the store; acts only through intents. */
export const GameUi = ({ store, intents }: { store: UiStore; intents: UiIntents }) => {
  const value = useMemo(() => ({ store, intents }), [store, intents]);
  return (
    <UiContext.Provider value={value}>
      <Screens />
    </UiContext.Provider>
  );
};
