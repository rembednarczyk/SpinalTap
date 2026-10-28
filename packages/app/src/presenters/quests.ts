import { CONTRACT_KINDS, type Contract, FACTIONS, contractClearedNote, contractFailureNote, contractGiver, contractKind } from "@seki/core";
import type { Presenter } from "./context";

/** Body of the "new contract" toast: what is at stake and what it pays. */
const acceptedText = (c: Contract): string => {
  const pay = `Stawka: ${c.reward} €$`;
  switch (contractKind(c)) {
    case "delivery":
      return `Paczka dla Hany na targu. ${pay}`;
    case "retrieve":
      return `Strażnicy: ${c.targets}. ${pay}`;
    case "protect":
      return `Hebi idą po Oyaji: ${c.targets}. ${pay}`;
    case "eliminate":
      return `Cele: ${c.targets}. ${pay}`;
    case "escort":
      return `Mika czeka przy kontenerze Genzō. Tessen: ${c.targets}. ${pay}`;
    case "infiltrate":
      return `Biuro Tessen, strażnicy: ${c.targets}. Bez alarmu. ${pay}`;
    case "hack":
      return `Terminal pod dźwigiem, potem fala Tessen. ${pay}`;
  }
};

/** Quests, contracts and the story: objectives, contract steps, reputation, endings and memories. */
export const presentQuests: Presenter = ({ bus, render, audio, toast }) => [
  bus.on("QuestAdvanced", (e) => {
    toast("quest", "Zadanie zaktualizowane", e.objective);
    audio.play("quest-update");
  }),
  bus.on("QuestCompleted", (e) => {
    toast("quest", "Zlecenie wykonane", e.title);
    audio.play("quest-update");
  }),
  bus.on("ContractAccepted", (e) => {
    toast("quest", `Nowy kontrakt: ${CONTRACT_KINDS[contractKind(e.contract)].title}`, acceptedText(e.contract));
    audio.play("quest-update");
  }),
  bus.on("ContractCleared", (e) => {
    toast("quest", contractClearedNote(e.contract), `Wróć do ${contractGiver(e.contract).genitive} po zapłatę`);
    audio.play("quest-update");
  }),
  bus.on("ContractAlarm", (e) => {
    const escort = contractKind(e.contract) === "escort";
    toast("quest", escort ? "Zasadzka Tessen" : "Alarm w porcie", escort ? "Osłoń Mikę" : "Utrzymaj terminal, ochrona już idzie");
    audio.play("quest-update");
  }),
  bus.on("ContractFailed", (e) => {
    toast("quest", "Kontrakt przepadł", contractFailureNote(e.reason, contractKind(e.contract)));
    audio.play("denied");
  }),
  bus.on("ReputationChanged", (e) => {
    if (e.delta !== 0) toast("reputation", `${FACTIONS[e.faction]} ${e.delta > 0 ? "+" : ""}${e.delta}`, "Reputacja");
  }),
  bus.on("EndingReached", (e) => {
    toast("quest", e.act === 2 ? "Koniec aktu II: Lustro" : "Koniec aktu I: Echo", `Zakończenie: ${e.title}`);
    audio.play("quest-update");
  }),
  bus.on("MemoryUnlocked", (e) => {
    toast("memory", e.title, e.description);
    render.playEffect({ kind: "memory-glitch" });
    audio.play("memory");
  }),
];
