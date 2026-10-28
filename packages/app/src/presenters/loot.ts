import { STACKABLE_CATALOG } from "@seki/core";
import { lootSummary } from "../loot-view";
import type { Presenter } from "./context";

/** The bag and the backpack: what was taken, what was lost, what did not fit, what was used. */
export const presentLoot: Presenter = ({ bus, render, audio, toast }) => [
  bus.on("InventoryFull", () => {
    toast("system", "Plecak pełny", "Zrób miejsce, zanim weźmiesz więcej.");
    audio.play("denied");
  }),
  bus.on("LootTaken", (e) => {
    if (e.lines.length === 0) return;
    toast("money", "Łup", lootSummary(e.lines));
    audio.play("loot-pickup");
  }),
  bus.on("LootExpired", () => toast("system", "Torba przepadła", "Ktoś był szybszy.")),
  bus.on("ItemUsed", (e) => {
    toast("system", `${STACKABLE_CATALOG[e.itemId].name}: +${e.healed} HP`);
    render.playEffect({ kind: "heal" });
    audio.play("heal");
  }),
];
