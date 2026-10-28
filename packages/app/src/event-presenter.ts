import {
  type AudioPort,
  CONTRACT_KINDS,
  type Contract,
  CYBERWARE_CATALOG,
  type DomainEvents,
  type EntityId,
  type EventBus,
  FACTIONS,
  type FactionId,
  type PurchaseFailure,
  STACKABLE_CATALOG,
  type ShopId,
  itemSummary,
  shopItemName,
  type RenderPort,
  contractClearedNote,
  contractFailureNote,
  contractGiver,
  contractKind,
  formatClock,
} from "@seki/core";
import { type UiStore, dismissToast, patchUi, pushToast } from "@seki/ui";
import { lootSummary } from "./loot-view";

const TOAST_MS = 4500;
/** Landings from lower than this (a kerb, a stair) make no sound of their own; footsteps cover them. */
const LANDING_SOUND_DROP = 0.5;

const REFUSAL: Partial<Record<FactionId, string>> = { clinic: "Mori zamyka drzwi kliniki", civilians: "Oyaji opuszcza roletę" };

/** Who shakes their head when a trade does not happen. */
const SHOPKEEPER: Readonly<Record<ShopId, string>> = { clinic: "Mori", oyaji: "Oyaji" };

const FAILURE_TEXT: Readonly<Record<PurchaseFailure, string>> = {
  "insufficient-funds": "Za mało eddies.",
  "already-installed": "To już masz.",
  "inventory-full": "Nie uniesiesz więcej.",
  refused: "Nie obsługuję takich jak ty.",
  closed: "Zamknięte. Wróć za dnia.",
  "not-found": "Nie masz tego przy sobie.",
  "in-use": "Najpierw to zdejmij.",
  "not-sold-here": "Tego tu nie ma.",
  "not-bought-here": "Tego nie skupuję.",
  worthless: "Nikt za to nie zapłaci.",
  "not-damaged": "Tu nie ma czego naprawiać.",
  "max-capacity": "Większego plecaka nie mam.",
  "empty-slot": "Tam nic nie siedzi.",
};

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

export interface PresenterHooks {
  playerId(): EntityId | null;
  onDialogue(dialogueId: string): void;
  /** A shop counter opened; `dialogueId` is its keeper's ink knot. */
  onShop(shopId: ShopId, dialogueId: string): void;
  /** The player opened a bag (`key` of its container). */
  onLoot(key: string): void;
  onPlayerDied(): void;
  /** Violence cut a conversation or the shop short; the sim has already freed the player. */
  onDialogueInterrupted(reason: DomainEvents["DialogueInterrupted"]["reason"]): void;
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
    bus.on("WeaponToggled", (e) => {
      render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: e.drawn });
      if (isPlayer(e.entityId)) audio.play("ui-select");
    }),
    bus.on("WeaponSwitched", (e) => {
      render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: true, slot: e.slot });
      if (isPlayer(e.entityId)) audio.play("weapon-switch");
    }),
    // Melee (ADR-0019): the swing plays over the simulation's timing; the whoosh comes as it lands.
    bus.on("MeleeSwing", (e) => render.playEffect({ kind: "melee", entityId: e.entityId, strike: e.strike, windup: e.windup, recovery: e.recovery })),
    bus.on("MeleeStrike", () => audio.play("swing")),
    bus.on("AttackBlocked", (e) => {
      render.playEffect({ kind: "block", entityId: e.defenderId, parried: e.parried, at: e.at });
      audio.play(e.parried ? "parry" : "block");
    }),
    bus.on("Staggered", (e) => render.playEffect({ kind: "stagger", entityId: e.entityId, duration: e.duration })),
    bus.on("ReloadStarted", (e) => {
      render.playEffect({ kind: "reload", entityId: e.entityId, duration: e.duration });
      if (isPlayer(e.entityId)) audio.play("reload");
    }),
    bus.on("InventoryFull", () => {
      toast("system", "Plecak pełny", "Zrób miejsce, zanim weźmiesz więcej.");
      audio.play("denied");
    }),
    bus.on("DamageDealt", (e) => {
      render.playEffect({ kind: "hit-spark", at: e.at, critical: e.critical });
      render.playEffect({ kind: "flinch", entityId: e.targetId });
      if (isPlayer(e.targetId)) {
        patchUi(ui, { hurtFlash: ui.getState().hurtFlash + 1 });
        audio.play("hurt");
      } else if (isPlayer(e.sourceId)) {
        patchUi(ui, { hitMarker: ui.getState().hitMarker + 1, hitZone: e.zone });
        audio.play(e.critical || e.zone === "head" ? "critical" : "hit");
      }
    }),
    bus.on("EntityKilled", () => audio.play("kill")),
    // Jumps and landings (ADR-0021): the player's own; a step off a kerb stays silent.
    bus.on("Jumped", (e) => {
      if (isPlayer(e.entityId)) audio.play("jump");
    }),
    // Hands and boots on the ledge edge: a light landing.
    bus.on("Mantled", (e) => {
      if (isPlayer(e.entityId)) audio.play("land");
    }),
    bus.on("Landed", (e) => {
      if (!isPlayer(e.entityId) || e.drop < LANDING_SOUND_DROP) return;
      audio.play(e.hard ? "land-hard" : "land");
    }),
    bus.on("PlayerDied", () => hooks.onPlayerDied()),
    bus.on("DialogueInterrupted", (e) => {
      hooks.onDialogueInterrupted(e.reason);
      toast("system", "Rozmowa przerwana", e.reason === "damage" ? "Ktoś do ciebie strzela!" : "Strzały tuż obok. Nie czas na gadanie.");
    }),
    bus.on("InteractionFocusChanged", (e) => patchUi(ui, { prompt: e.prompt })),
    bus.on("InteractionStarted", (e) => {
      if (e.kind === "shop") hooks.onShop(e.shopId ?? "clinic", e.dialogueId);
      else if (e.kind === "loot") hooks.onLoot(e.dialogueId);
      else hooks.onDialogue(e.dialogueId);
    }),
    bus.on("LootTaken", (e) => {
      if (e.lines.length === 0) return;
      toast("money", "Łup", lootSummary(e.lines));
      audio.play("loot-pickup");
    }),
    bus.on("LootExpired", () => toast("system", "Torba przepadła", "Ktoś był szybszy.")),
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
      if (e.delta > 0 && e.source === undefined) toast("money", `+${e.delta.toLocaleString("pl-PL")} €$`, "Przelew");
    }),
    bus.on("CyberwareInstalled", (e) => {
      const def = CYBERWARE_CATALOG[e.cyberwareId];
      const old = e.replaced ? CYBERWARE_CATALOG[e.replaced].name : null;
      const text = old === null ? def.description : e.stowed ? `${old} wraca do plecaka` : `Usunięto: ${old}`;
      toast("cyberware", `Wszczepiono: ${def.name}`, text);
      audio.play("purchase");
    }),
    bus.on("CyberwareRemoved", (e) => {
      toast("cyberware", `Wymontowano: ${CYBERWARE_CATALOG[e.cyberwareId].name}`, "Implant w plecaku");
      audio.play("ui-select");
    }),
    bus.on("ItemBought", (e) => {
      const qty = (e.qty ?? 1) > 1 ? ` × ${e.qty}` : "";
      toast("system", `Kupiono: ${shopItemName(e.itemId)}${qty}`, `-${e.price} €$`);
      audio.play("purchase");
    }),
    bus.on("ItemSold", (e) => {
      toast("money", `Sprzedano: ${itemSummary(e.defId).name}${e.qty > 1 ? ` × ${e.qty}` : ""}`, `+${e.price} €$`);
      audio.play("sell");
    }),
    bus.on("ItemRepaired", (e) => {
      toast("system", `Naprawiono: ${itemSummary(e.defId).name}`, e.parts > 0 ? `-${e.price} €$, części: ${e.parts}` : `-${e.price} €$`);
      audio.play("repair");
    }),
    bus.on("CapacityUpgraded", (e) => {
      toast("system", "Większy plecak", `Miejsc: ${e.capacity}`);
      audio.play("purchase");
    }),
    bus.on("PurchaseFailed", (e) => {
      toast("system", `${SHOPKEEPER[e.shopId ?? "clinic"]} kręci głową`, FAILURE_TEXT[e.reason]);
      audio.play("denied");
    }),
    bus.on("ItemUsed", (e) => {
      toast("system", `${STACKABLE_CATALOG[e.itemId].name}: +${e.healed} HP`);
      render.playEffect({ kind: "heal" });
      audio.play("heal");
    }),
    bus.on("AbilityActivated", () => {
      render.playEffect({ kind: "overdrive", active: true });
      audio.play("overdrive");
    }),
    bus.on("AbilityEnded", () => render.playEffect({ kind: "overdrive", active: false })),
    bus.on("ContractAccepted", (e) => {
      toast("quest", `Nowy kontrakt: ${CONTRACT_KINDS[contractKind(e.contract)].title}`, acceptedText(e.contract));
      audio.play("quest-update");
    }),
    bus.on("ContractCleared", (e) => {
      toast("quest", contractClearedNote(e.contract), `Wróć do ${contractGiver(e.contract).genitive} po zapłatę`);
      audio.play("quest-update");
    }),
    bus.on("ContractAlarm", (e) => {
      toast("quest", contractKind(e.contract) === "escort" ? "Zasadzka Tessen" : "Alarm w porcie", contractKind(e.contract) === "escort" ? "Osłoń Mikę" : "Utrzymaj terminal, ochrona już idzie");
      audio.play("quest-update");
    }),
    // The sniper's telegraph (ADR-0024): the laser is the warning.
    bus.on("SniperAimed", (e) => render.playEffect({ kind: "laser", shooterId: e.entityId, targetId: e.targetId, duration: e.duration })),
    bus.on("ContractFailed", (e) => {
      toast("quest", "Kontrakt przepadł", contractFailureNote(e.reason));
      audio.play("denied");
    }),
    bus.on("ReputationChanged", (e) => {
      if (e.delta !== 0) toast("reputation", `${FACTIONS[e.faction]} ${e.delta > 0 ? "+" : ""}${e.delta}`, "Reputacja");
    }),
    bus.on("EndingReached", (e) => {
      toast("quest", e.act === 2 ? "Koniec aktu II: Lustro" : "Koniec aktu I: Echo", `Zakończenie: ${e.title}`);
      audio.play("quest-update");
    }),
    bus.on("TimeSkipped", (e) => toast("system", `Mija czas: ${formatClock(e.clock)}`, `${Math.floor(e.minutes / 60)} h ${e.minutes % 60} min później`)),
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
