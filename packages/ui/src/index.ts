import "./styles.css";
import "./wave2.css";

export * from "./store/ui-store";
export * from "./intents";
export { GameUi } from "./game-ui";
export { AUTOSAVE_SLOT, SAVE_SLOTS } from "./menus/save-slots";
export { quickhacksFor } from "./hud/scanner";
export { BADGE_ICON } from "./hud/contract-card";
export { TOKENS, type TokenId } from "./hud/tokens";
export * from "./breach/breach-logic";
export type { TouchButton, TouchPadSink } from "./touch/touch-pad-sink";
export { capacityCost, capacityFit, overCapacityText, type CapacityFit } from "./shop/capacity";
export { RADIO_KEY } from "./radio/radio";
export { MINIMAP_RANGE, LOOK_AHEAD } from "./hud/minimap";
export {
  translate,
  translator,
  translateText,
  textTranslator,
  formatMessage,
  isMessageKey,
  type MessageKey,
  type Translate,
  type TranslateText,
} from "./i18n/t";
export type { Message, MessageParams, PluralMessage } from "./i18n/message";
export { useT, useText } from "./i18n/use-t";
export { formatNumber } from "./i18n/number";
export { CREDITS, CREDIT_SECTIONS, LICENSES, type Credit, type CreditLicense, type CreditSection } from "./credits/credits";
