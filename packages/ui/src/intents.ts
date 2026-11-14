import type { AttributeId, BreachDaemonId, CyberwareId, CyberwareSlot, DifficultyProfile, EquipSlot, ItemRef, MetroStationId, ModSlot, PerkId, QuickhackSlotInput, ShopItemId } from "@seki/core";
import type { CharacterTab, GraphicsEffectId, RadioStationId, SettingsVm } from "./store/ui-store";

/** Where the 3D preview of the character screen is drawn, in CSS pixels of the page. */
export interface PreviewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The game as a whole: a new game, pause, the title screen, saves (ADR-0031). */
export interface SessionIntents {
  /** A new game on `difficulty` (ADR-0066), "normal" without. */
  newGame(difficulty?: DifficultyProfile): void;
  resume(): void;
  pause(): void;
  save(slot: string): void;
  load(slot: string): void;
  /** Writes a saved slot to a file for the player to keep. */
  exportSave(slot: string): void;
  /** Reads a save file the player picked into its own slot. */
  importSave(text: string): void;
  quitToTitle(): void;
}

/** The conversation on screen. */
export interface DialogueIntents {
  choose(index: number): void;
  closeDialogue(): void;
}

/** The open shop counter (clinic, Oyaji, the yatai). */
export interface ShopIntents {
  buyCyberware(id: CyberwareId): void;
  /** Buys one entry of the open shop's stock. */
  buyItem(id: ShopItemId): void;
  /** Sells `qty` of a stack, or one piece, to the open shop. */
  sellItem(ref: ItemRef, qty: number): void;
  /** Mends a garment at the stall, spending up to `useParts` weapon parts. */
  repairItem(uid: string, useParts: number): void;
  /** The next backpack upgrade at the stall. */
  upgradeBackpack(): void;
  /** Doktor Mori fits an implant from the bag. */
  installCyberwareItem(uid: string): void;
  /** Doktor Mori takes an implant out into the bag. */
  removeCyberware(slot: CyberwareSlot): void;
  /** Doktor Mori resets the attributes and perks for a fee (ADR-0059): every point comes back. */
  respec(): void;
  closeShop(): void;
  /** Leaves the counter for a conversation with the shopkeeper (Mori or Oyaji). */
  talkToShopkeeper(): void;
}

/** The bag being searched. */
export interface LootIntents {
  /** Takes one line of the open bag, or everything that fits. */
  takeLoot(line: number | "all"): void;
  /** Leaves the bag as it is. */
  closeLoot(): void;
}

/** Character screen (plan §7 and §8.5): tabs, the 3D preview, equipment and mods. The clock stands while it is open. */
export interface CharacterIntents {
  /** The screen opened on `tab`, or moved to it. */
  openCharacterScreen(tab: CharacterTab): void;
  closeCharacterScreen(): void;
  /** Rectangle of the 3D preview; null hides it. */
  setPreviewViewport(rect: PreviewRect | null): void;
  /** Turns the previewed character by `deltaYaw` radians. */
  rotatePreview(deltaYaw: number): void;
  /** Back to the front view. */
  resetPreview(): void;
  // Menu actions; each one applies at once.
  equip(uid: string, slot?: EquipSlot): void;
  unequip(slot: EquipSlot): void;
  useItem(ref: ItemRef): void;
  dropItem(ref: ItemRef, qty: number): void;
  installMod(weaponUid: string, modUid: string): void;
  removeMod(weaponUid: string, slot: ModSlot): void;
}

/** Character progression (ADR-0059): the Progress tab's attribute and perk points (stage 7). */
export interface ProgressionIntents {
  /** Puts one unspent point into `attribute`; the game refuses it without a point or at 15. */
  spendAttributePoint(attribute: AttributeId): void;
  /** Buys one rank of `perk`; the game refuses it without a point, below its tier or at its last rank. */
  spendPerkPoint(perk: PerkId): void;
}

/** Settings and key bindings. */
export interface SettingsIntents {
  /** Saves the changed settings; look sensitivity applies at once. */
  changeSettings(patch: Partial<SettingsVm>): void;
  /** Binds a key (KeyboardEvent.code, "MouseN", "WheelUp"/"WheelDown") to a control, taking it off any other. */
  bindKey(action: string, code: string): void;
  /** Every control back to its default keys. */
  resetControls(): void;
  /** Reloads the game so settings that need a restart take effect. */
  reload(): void;
}

/** The difficulty of the running game (ADR-0066), from the pause menu. */
export interface DifficultyIntents {
  /** Asks for the whole profile: in force at once, or after the fight when one is on. */
  setDifficulty(profile: DifficultyProfile): void;
}

/** The game camera (ADR-0049). */
export interface CameraIntents {
  /** Horizontal field of view from the hip, degrees; the app clamps it to the allowed range and saves it. */
  setFieldOfView(degrees: number): void;
}

/** The graphics switches (graphics toggles 14.11): an effect of the High quality on or off, at once. */
export interface GraphicsIntents {
  /** Saves the choice; a quality without the effect keeps it off. */
  setGraphicsEffect(effect: GraphicsEffectId, on: boolean): void;
}

/** The phone (ADR-0028). */
export interface PhoneIntents {
  /** The phone (T or the touch button): the inbox with a thread per contact. */
  openPhone(): void;
  closePhone(): void;
  /** Marks a contact's thread as read. */
  readThread(from: string): void;
}

/** Contract HUD cards (ADR-0028). */
export interface ContractIntents {
  /** Closes the contract debrief card. */
  dismissDebrief(): void;
}

/** The journal: which entry the HUD follows. */
export interface JournalIntents {
  /** Follow this entry (a quest id or `contract-<id>`) on the HUD; null lets the game pick. */
  trackQuest(questId: string | null): void;
}

/** Scanner, quickhacks and the breach minigame (ADR-0028). */
export interface HackIntents {
  /** Touch: the scanner button (held on the keyboard through the input frame). */
  setScan(on: boolean): void;
  /** Touch: a tap on the n-th quickhack of the scanner list. */
  pickQuickhack(slot: Exclude<QuickhackSlotInput, 0>): void;
  /** The breach minigame ended with these daemons (none when the player disconnected). */
  submitBreach(daemons: readonly BreachDaemonId[]): void;
}

/**
 * Everything the UI can ask the game to do, as the sum of the narrow interfaces above.
 * Implemented by the app composition root; components take only their part (ADR-0031).
 */
export type UiIntents = SessionIntents &
  DialogueIntents &
  ShopIntents &
  LootIntents &
  CharacterIntents &
  ProgressionIntents &
  SettingsIntents &
  DifficultyIntents &
  CameraIntents &
  GraphicsIntents &
  PhoneIntents &
  ContractIntents &
  JournalIntents &
  HackIntents &
  MetroIntents &
  RadioIntents &
  WaitIntents;

// ---- Wave 2 (ADR-0035) ----

/** The metro: the line map at the ticket kiosk, a ticket in two steps (ADR-0071). */
export interface MetroIntents {
  /** First step: the destination, which shows the route and the preview of `to`. */
  selectMetroStop(to: MetroStationId): void;
  /** Second step: buys the ticket to the chosen stop and rides (the `travel-metro` command). */
  buyMetroTicket(): void;
  /** Leaves the kiosk without a ticket. */
  closeMetro(): void;
}

/** The radio (B, or the phone): three stations and off. */
export interface RadioIntents {
  setRadioStation(id: RadioStationId | null): void;
  /** The next station in the list, then off, then the first again. */
  nextRadioStation(): void;
}


/** Waiting: the window that lets game hours pass, from the pause menu or its key (the `wait` command). */
export interface WaitIntents {
  /** Opens the window; refused (the reason as a toast) in a fight, an alarm, a pursuit or with another panel up. */
  openWait(): void;
  closeWait(): void;
  /** Lets `hours` (whole, 1 to 24) pass at once and closes the window. */
  waitHours(hours: number): void;
}
