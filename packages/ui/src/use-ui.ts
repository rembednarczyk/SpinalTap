import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { UiIntents } from "./intents";
import type { UiState, UiStore } from "./store/ui-store";

export const UiContext = createContext<{ store: UiStore; intents: UiIntents } | null>(null);

const useUiContext = () => {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("UiContext missing");
  return ctx;
};

export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useUiContext().store, selector);

export const useIntents = (): UiIntents => useUiContext().intents;
