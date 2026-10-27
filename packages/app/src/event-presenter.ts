import {
  type AudioPort,
  CYBERWARE_CATALOG,
  type DomainEvents,
  type EntityId,
  type EventBus,
  FACTIONS,
  type FactionId,
  ITEM_CATALOG,
  type RenderPort,
} from "@seki/core";
import { type UiStore, dismissToast, patchUi, pushToast } from "@seki/ui";

const TOAST_MS = 4500;

const REFUSAL: Partial<Record<FactionId, string>> = { clinic: "Mori zamyka drzwi kliniki" };

export interface PresenterHooks {
  playerId(): EntityId | null;
  onDialogue(dialogueId: string): void;
  onShop(): void;
  onPlayerDied(): void;
}

/**
 * Translates domain events into presentation: UI store updates and toasts, audio cues and
 * render effects. The only place where the three presentation channels meet.
 */
export const bindEventPresenter = (bus: EventBus<DomainEvents>, render: RenderPort, audio: AudioPort, ui: UiStore, hooks: PresenterHooks): (() => void) => {
  const toast = (kind: Parameters<typeof pushToast>[1]["kind"], title: string, text = "") => {
    const id = pushToast(ui, { kind, title, text });
    setTimeout(() => dismissToast(ui, id), TOAST_MS);
  };
  const isPlayer = (id: EntityId) => id === hooks.playerId();

  const offs = [
    bus.on("ShotFired", (e) => {
      render.playEffect({ kind: "muzzle-flash", shooterId: e.shooterId, from: e.from, to: e.to });
      audio.play(isPlayer(e.shooterId) ? "shot" : "enemy-shot");
    }),
    bus.on("WeaponToggled", (e) => render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: e.drawn })),
    bus.on("DamageDealt", (e) => {
      render.playEffect({ kind: "hit-spark", at: e.at, critical: e.critical });
      render.playEffect({ kind: "flinch", entityId: e.targetId });
      if (isPlayer(e.targetId)) {
        patchUi(ui, { hurtFlash: ui.getState().hurtFlash + 1 });
        audio.play("hurt");
      } else if (isPlayer(e.sourceId)) {
        patchUi(ui, { hitMarker: ui.getState().hitMarker + 1 });
        audio.play(e.critical || e.headshot ? "critical" : "hit");
      }
    }),
    bus.on("EntityKilled", () => audio.play("kill")),
    bus.on("PlayerDied", () => hooks.onPlayerDied()),
    bus.on("InteractionFocusChanged", (e) => patchUi(ui, { prompt: e.prompt })),
    bus.on("InteractionStarted", (e) => (e.kind === "shop" ? hooks.onShop() : hooks.onDialogue(e.dialogueId))),
    bus.on("InteractionRefused", (e) => {
      toast("reputation", REFUSAL[e.faction] ?? `${FACTIONS[e.faction]} nie chce z tobą rozmawiać`, "Reputacja");
      audio.play("denied");
    }),
    bus.on("NpcReacted", (e) => {
      if (e.reaction === "warn") toast("reputation", "Hebi: „Idź swoją drogą, Seki.”", "Gangerzy cię przepuszczają");
      else toast("reputation", "Przechodnie uciekają", `${FACTIONS[e.faction]} boją się ciebie`);
    }),
    bus.on("CameraModeChanged", (e) => render.setCameraMode(e.mode)),
    bus.on("QuestAdvanced", (e) => {
      toast("quest", "Zadanie zaktualizowane", e.objective);
      audio.play("quest-update");
    }),
    bus.on("QuestCompleted", (e) => {
      toast("quest", "Zlecenie wykonane", e.title);
      audio.play("quest-update");
    }),
    bus.on("EddiesChanged", (e) => {
      if (e.delta > 0) toast("money", `+${e.delta.toLocaleString("pl-PL")} €$`, "Przelew od Kaito");
    }),
    bus.on("CyberwareInstalled", (e) => {
      const def = CYBERWARE_CATALOG[e.cyberwareId];
      toast("cyberware", `Wszczepiono: ${def.name}`, e.replaced ? `Usunięto: ${CYBERWARE_CATALOG[e.replaced].name}` : def.description);
      audio.play("purchase");
    }),
    bus.on("ItemBought", (e) => {
      toast("system", `Kupiono: ${ITEM_CATALOG[e.itemId].name}`, `-${e.price} €$`);
      audio.play("purchase");
    }),
    bus.on("PurchaseFailed", (e) => {
      const text = { "insufficient-funds": "Za mało eddies.", "already-installed": "To już masz.", "inventory-full": "Nie uniesiesz więcej.", refused: "Nie obsługuję takich jak ty." }[e.reason];
      toast("system", "Mori kręci głową", text);
      audio.play("denied");
    }),
    bus.on("ItemUsed", (e) => {
      toast("system", `${ITEM_CATALOG[e.itemId].name}: +${e.healed} HP`);
      render.playEffect({ kind: "heal" });
      audio.play("heal");
    }),
    bus.on("AbilityActivated", () => {
      render.playEffect({ kind: "overdrive", active: true });
      audio.play("overdrive");
    }),
    bus.on("AbilityEnded", () => render.playEffect({ kind: "overdrive", active: false })),
    bus.on("ContractAccepted", (e) => {
      toast("quest", "Nowy kontrakt", `Cele: ${e.contract.targets}. Stawka: ${e.contract.reward} €$`);
      audio.play("quest-update");
    }),
    bus.on("ContractCleared", () => {
      toast("quest", "Cel zneutralizowany", "Wróć do Kaito po zapłatę");
      audio.play("quest-update");
    }),
    bus.on("ReputationChanged", (e) => {
      if (e.delta !== 0) toast("reputation", `${FACTIONS[e.faction]} ${e.delta > 0 ? "+" : ""}${e.delta}`, "Reputacja");
    }),
    bus.on("EndingReached", (e) => {
      toast("quest", "Koniec aktu I: Echo", `Zakończenie: ${e.title}`);
      audio.play("quest-update");
    }),
    bus.on("MemoryUnlocked", (e) => {
      toast("memory", e.title, e.description);
      render.playEffect({ kind: "memory-glitch" });
      audio.play("memory");
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
};
