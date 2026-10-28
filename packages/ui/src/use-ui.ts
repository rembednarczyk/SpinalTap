import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type {
  CharacterIntents,
  ContractIntents,
  JournalIntents,
  DialogueIntents,
  HackIntents,
  LootIntents,
  PhoneIntents,
  SessionIntents,
  SettingsIntents,
  ShopIntents,
  UiIntents,
} from "./intents";
import type { UiState, UiStore } from "./store/ui-store";

export const UiContext = createContext<{ store: UiStore; intents: UiIntents } | null>(null);

const useUiContext = () => {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("UiContext missing");
  return ctx;
};

export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useUiContext().store, selector);

/** Every intent at once: only for composition (GameUi) and tests. Components take a narrow hook below (ADR-0031). */
export const useIntents = (): UiIntents => useUiContext().intents;

export const useSessionIntents = (): SessionIntents => useUiContext().intents;
export const useDialogueIntents = (): DialogueIntents => useUiContext().intents;
export const useShopIntents = (): ShopIntents => useUiContext().intents;
export const useLootIntents = (): LootIntents => useUiContext().intents;
export const useCharacterIntents = (): CharacterIntents => useUiContext().intents;
export const useSettingsIntents = (): SettingsIntents => useUiContext().intents;
export const usePhoneIntents = (): PhoneIntents => useUiContext().intents;
export const useContractIntents = (): ContractIntents => useUiContext().intents;
export const useJournalIntents = (): JournalIntents => useUiContext().intents;
export const useHackIntents = (): HackIntents => useUiContext().intents;
