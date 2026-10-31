import { CONTRACT_KINDS, type Contract, FACTIONS, contractClearedNote, contractFailureNote, contractKind } from "@seki/core";
import { type Translate, type TranslateText, translate, translateText } from "@seki/ui";
import { returnForPay } from "../journal";
import type { Presenter } from "./context";

/** Body of the "new contract" toast: what is at stake and what it pays. */
const acceptedText = (t: Translate, c: Contract): string => t(`quest.accepted.${contractKind(c)}`, { targets: c.targets, pay: t("quest.pay", { reward: c.reward }) });

/** Quests, contracts and the story: objectives, contract steps, reputation, endings and memories. */
export const presentQuests: Presenter = ({ bus, render, audio, ui, toast }) => {
  // A toast is written in the language of the moment it appears (ADR-0056).
  const locale = () => ui.getState().settings.locale;
  const t: Translate = (key, params) => translate(locale(), key, params);
  // Events from the simulation carry catalog keys (ADR-0056, stage 3).
  const tx: TranslateText = (text) => translateText(locale(), text);
  return [
    bus.on("QuestAdvanced", (e) => {
      toast("quest", t("quest.updated"), tx(e.objective));
      audio.play("quest-update");
    }),
    bus.on("QuestCompleted", (e) => {
      toast("quest", t("quest.completed"), tx(e.title));
      audio.play("quest-update");
    }),
    bus.on("ContractAccepted", (e) => {
      toast("quest", t("quest.contractNew", { kind: CONTRACT_KINDS[contractKind(e.contract)].title }), acceptedText(t, e.contract));
      audio.play("quest-update");
    }),
    bus.on("ContractCleared", (e) => {
      toast("quest", contractClearedNote(e.contract), returnForPay(locale(), e.contract));
      audio.play("quest-update");
    }),
    bus.on("ContractAlarm", (e) => {
      const escort = contractKind(e.contract) === "escort";
      toast("quest", escort ? t("quest.ambush") : t("quest.alarm"), escort ? t("quest.coverMika") : t("quest.holdTerminal"));
      audio.play("quest-update");
    }),
    bus.on("ContractFailed", (e) => {
      toast("quest", t("quest.failed"), contractFailureNote(e.reason, contractKind(e.contract)));
      audio.play("denied");
    }),
    bus.on("ReputationChanged", (e) => {
      if (e.delta !== 0) toast("reputation", `${t(FACTIONS[e.faction])} ${e.delta > 0 ? "+" : ""}${e.delta}`, t("world.reputation"));
    }),
    bus.on("EndingReached", (e) => {
      toast("quest", e.act === 2 ? t("quest.endAct2") : t("quest.endAct1"), t("quest.ending", { title: tx(e.title) }));
      audio.play("quest-update");
    }),
    bus.on("MemoryUnlocked", (e) => {
      toast("memory", tx(e.title), tx(e.description));
      render.playEffect({ kind: "memory-glitch" });
      audio.play("memory");
    }),
  ];
};
