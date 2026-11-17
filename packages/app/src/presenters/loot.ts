import { STACKABLE_CATALOG } from "@seki/core";
import { lootSummary } from "../loot-view";
import type { Presenter } from "./context";
import { uiDomainText, uiText } from "./trade";

/**
 * The bag and the backpack: what was taken, what did not fit, what was used. A bag that lay too
 * long goes quietly (G-915): nobody takes it in the simulation, so "someone was faster" was untrue,
 * and it came for bags far off, in unloaded chunks and pushed out by the cap as well.
 */
export const presentLoot: Presenter = ({ bus, render, audio, toast, ui }) => [
  bus.on("InventoryFull", () => {
    const t = uiText(ui);
    toast("system", t("loot.full"), t("loot.fullText"));
    audio.play("denied");
  }),
  bus.on("LootTaken", (e) => {
    if (e.lines.length === 0) return;
    const t = uiText(ui);
    toast("money", t("loot.toast"), lootSummary(t, uiDomainText(ui), e.lines));
    audio.play("loot-pickup");
  }),
  bus.on("ItemUsed", (e) => {
    toast("system", `${uiDomainText(ui)(STACKABLE_CATALOG[e.itemId].name)}: +${e.healed} HP`);
    render.playEffect({ kind: "heal" });
    audio.play("heal");
  }),
];
