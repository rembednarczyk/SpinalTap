import type { EquipSlot, GameCommand, ItemRef, ModSlot } from "@seki/core";
import { type CharacterIntents, type CharacterTab, type PreviewRect, type UiStore, characterTabState, patchUi } from "@seki/ui";
import { type PreviewHost, createAppearanceCache } from "../character-view";
import type { Focus, SimRef } from "./shared";

export interface CharacterMenuControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly focus: Focus;
  /** 3D preview of the menu (the engine's PreviewStage in the browser). */
  readonly preview?: PreviewHost;
  /** The menu may open now: playing, and no conversation, shop or bag on screen. */
  readonly canOpen: () => boolean;
  /** Pushes the HUD (and the menu's numbers) after a menu command. */
  readonly syncHud: () => void;
}

/**
 * Character menu (plan §7, §8.5): tabs, the 3D preview, equipment and mods. The clock stands
 * while it is open (ADR-0015).
 */
export class CharacterMenuController implements CharacterIntents {
  private characterOpen = false;
  /**
   * Last rectangle the menu's preview box reported. React runs the box's effect before the
   * screen's own, so the rectangle can arrive just before the menu says it opened.
   */
  private previewRect: PreviewRect | null = null;
  private readonly appearance = createAppearanceCache();

  constructor(private readonly deps: CharacterMenuControllerDeps) {}

  get isOpen(): boolean {
    return this.characterOpen;
  }

  /** Same frame as a menu command: the preview gets the new look before it draws. */
  renderPreview(): void {
    if (this.characterOpen) this.deps.preview?.setAppearance(this.appearance(this.deps.sim().domain));
  }

  /** The UI opened the menu (I, Tab, J or the touch button) or moved to another tab. */
  openCharacterScreen(tab: CharacterTab): void {
    if (!this.deps.canOpen()) {
      patchUi(this.deps.ui, characterTabState(null));
      return;
    }
    patchUi(this.deps.ui, { ...characterTabState(tab), prompt: null });
    if (this.characterOpen) return;
    this.characterOpen = true;
    this.deps.preview?.setAppearance(this.appearance(this.deps.sim().domain));
    this.deps.preview?.setViewport(this.previewRect);
    this.deps.focus.panel();
  }

  closeCharacterScreen(): void {
    if (!this.characterOpen) return;
    this.closeSilently();
    this.deps.focus.settle();
  }

  /** Closes the menu without moving the pointer (a load, the title screen, death). */
  closeSilently(): void {
    if (!this.characterOpen) return;
    this.characterOpen = false;
    this.deps.preview?.setViewport(null);
    patchUi(this.deps.ui, characterTabState(null));
  }

  setPreviewViewport(rect: PreviewRect | null): void {
    this.previewRect = rect;
    if (this.characterOpen) this.deps.preview?.setViewport(rect);
  }

  rotatePreview(deltaYaw: number): void {
    this.deps.preview?.rotate(deltaYaw);
  }

  resetPreview(): void {
    this.deps.preview?.reset();
  }

  equip(uid: string, slot?: EquipSlot): void {
    this.menuCommand(slot === undefined ? { type: "equip-item", uid } : { type: "equip-item", uid, slot });
  }

  unequip(slot: EquipSlot): void {
    this.menuCommand({ type: "unequip-item", slot });
  }

  useItem(ref: ItemRef): void {
    this.menuCommand({ type: "use-item", ref });
  }

  dropItem(ref: ItemRef, qty: number): void {
    this.menuCommand({ type: "drop-item", ref, qty });
  }

  installMod(weaponUid: string, modUid: string): void {
    this.menuCommand({ type: "install-mod", weaponUid, modUid });
  }

  removeMod(weaponUid: string, slot: ModSlot): void {
    this.menuCommand({ type: "remove-mod", weaponUid, slot });
  }

  /**
   * A command from the menu applies at once although the clock stands: the command phase of
   * the next step runs now (`applyPendingCommands`), and the menu, the HUD and the preview see
   * the result in this frame.
   */
  private menuCommand(cmd: GameCommand): void {
    if (!this.characterOpen) return;
    const sim = this.deps.sim();
    sim.enqueue(cmd);
    sim.applyPendingCommands();
    this.deps.syncHud();
    this.deps.preview?.setAppearance(this.appearance(this.deps.sim().domain));
  }
}
