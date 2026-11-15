import { useEffect, useState } from "react";
import { useUi } from "../use-ui";
import { NO_SAFE_AREA, type SafeArea, type ScreenBox, type UiScale, uiScale } from "./ui-scale";

const screenNow = (): ScreenBox => ({ width: window.innerWidth, height: window.innerHeight });

/** The safe area's insets, read through a hidden probe padded by `env(safe-area-inset-*)`. */
const safeAreaNow = (): SafeArea => {
  if (typeof document === "undefined" || !document.body) return NO_SAFE_AREA;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.append(probe);
  const s = getComputedStyle(probe);
  const px = (v: string) => Number.parseFloat(v) || 0;
  const safe = { top: px(s.paddingTop), right: px(s.paddingRight), bottom: px(s.paddingBottom), left: px(s.paddingLeft) };
  probe.remove();
  return safe;
};

/** The screen and its safe area, following resizes and turns of a phone. */
const useScreen = (): { screen: ScreenBox; safe: SafeArea } => {
  const [now, setNow] = useState(() => ({ screen: screenNow(), safe: safeAreaNow() }));
  useEffect(() => {
    const update = () => setNow({ screen: screenNow(), safe: safeAreaNow() });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return now;
};

/**
 * The scale the layers draw at now (ADR-0085), for places that size things in script: from the
 * HUD scale setting, the screen, its safe area and whether the pad is up.
 */
export const useUiScale = (touch: boolean): UiScale => {
  const setting = useUi((s) => s.settings.hudScale);
  const { screen, safe } = useScreen();
  return uiScale(setting, screen, safe, touch);
};

/**
 * Puts the scale on the document root, the one mechanism every layer reads (ADR-0085):
 * `--ui-scale` for the HUD, messages, cards and the dialogue, `--ui-touch-scale` for the pad's
 * layer, `--ui-touch-look` for its drawing within it and `--ui-touch-spread` for its pull toward
 * its corners.
 */
export const UiScaleRoot = ({ touch }: { touch: boolean }) => {
  const { ui, touch: pad, touchLook, touchSpread } = useUiScale(touch);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", String(ui));
    root.style.setProperty("--ui-touch-scale", String(pad));
    root.style.setProperty("--ui-touch-look", String(touchLook));
    root.style.setProperty("--ui-touch-spread", String(touchSpread));
  }, [ui, pad, touchLook, touchSpread]);
  return null;
};
