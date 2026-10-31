import { useEffect, useMemo } from "react";
import { DialoguePanel } from "./dialogue/dialogue-panel";
import { Hud } from "./hud/hud";
import { useT } from "./i18n/use-t";
import { CharacterScreen } from "./menus/character-screen";
import { ShopPanel } from "./shop/shop-panel";
import { LootPanel } from "./loot/loot-panel";
import { TouchControls } from "./touch/touch-controls";
import type { TouchPadSink } from "./touch/touch-pad-sink";
import type { UiIntents } from "./intents";
import { DeathScreen } from "./menus/death-screen";
import { LoadingScreen } from "./menus/loading-screen";
import { PauseMenu } from "./menus/pause-menu";
import { TitleScreen } from "./menus/title-screen";
import type { UiStore } from "./store/ui-store";
import { UiContext, useUi } from "./use-ui";
import { BreachPanel } from "./breach/breach-panel";
import { DebriefCard } from "./hud/contract-card";
import { PhonePanel } from "./phone/phone";
import { MetroMap, MetroRide } from "./metro/metro-panel";
import { RadioKey } from "./radio/radio";

/**
 * Accessibility settings on the document root (ADR-0028): HUD scale as `--hud-scale`, the
 * legible font, reduced flashes and the colour-blind palette as attributes the styles read.
 */
const Accessibility = () => {
  const scale = useUi((s) => s.settings.hudScale);
  const legible = useUi((s) => s.settings.legibleFont);
  const reduce = useUi((s) => s.settings.reduceFlashes);
  const palette = useUi((s) => s.settings.colorblind);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--hud-scale", String(scale));
    root.classList.toggle("legible-font", legible);
    root.classList.toggle("reduce-flashes", reduce);
    if (palette === "off") delete root.dataset.palette;
    else root.dataset.palette = palette;
  }, [scale, legible, reduce, palette]);
  return null;
};

const Screens = ({ touch, version }: { touch: TouchPadSink | undefined; version: string | undefined }) => {
  const screen = useUi((s) => s.screen);
  const modal = useUi((s) => s.dialogue !== null || s.shopOpen || s.loot !== null || s.phoneOpen || s.breach !== null || s.metroMap !== null || s.metroRide !== null);
  // The character screen covers the whole game; the HUD under it would only show through.
  const menu = useUi((s) => s.characterTab !== null) && screen === "playing";
  const t = useT();
  return (
    <>
      {touch && screen === "playing" && !modal && !menu && <TouchControls pad={touch} />}
      {touch && <div className="rotate-hint">{t("touch.rotate")}</div>}
      {screen !== "title" && screen !== "loading" && !menu && <Hud touch={touch} />}
      {screen === "playing" && <DialoguePanel />}
      {screen === "playing" && <ShopPanel />}
      {screen === "playing" && <LootPanel />}
      {screen === "playing" && <CharacterScreen />}
      {screen === "playing" && !menu && <DebriefCard />}
      {screen === "playing" && <PhonePanel />}
      {screen === "playing" && <BreachPanel />}
      {screen === "playing" && <MetroMap />}
      {screen === "playing" && <MetroRide />}
      {screen === "playing" && <RadioKey />}
      {screen === "title" && <TitleScreen version={version} />}
      {screen === "loading" && <LoadingScreen />}
      {screen === "paused" && <PauseMenu />}
      {screen === "dead" && <DeathScreen />}
    </>
  );
};

/**
 * Root of the React overlay. Reads only the store; acts only through intents. `version` is the build
 * shown on the title screen, so a bug report can name it.
 */
export const GameUi = ({ store, intents, touch, version }: { store: UiStore; intents: UiIntents; touch?: TouchPadSink; version?: string }) => {
  const value = useMemo(() => ({ store, intents }), [store, intents]);
  useEffect(() => {
    document.documentElement.classList.toggle("touch-mode", !!touch);
  }, [touch]);
  return (
    <UiContext.Provider value={value}>
      <Accessibility />
      <Screens touch={touch} version={version} />
    </UiContext.Provider>
  );
};
