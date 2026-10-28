import type { AudioPort } from "@seki/core";
import { type PhoneIntents, type UiStore, patchUi } from "@seki/ui";
import type { Focus } from "./shared";

export interface PhoneControllerDeps {
  readonly ui: UiStore;
  readonly audio: AudioPort;
  readonly focus: Focus;
  /** The phone may open now: playing, and no other panel or menu on screen. */
  readonly canOpen: () => boolean;
  /** Marks a contact's thread as read (the wave 1 HUD keeps the inbox). */
  readonly readThread: (from: string) => void;
}

/** The phone (ADR-0028): the inbox with a thread per contact. */
export class PhoneController implements PhoneIntents {
  private phoneOpen = false;

  constructor(private readonly deps: PhoneControllerDeps) {}

  get isOpen(): boolean {
    return this.phoneOpen;
  }

  openPhone(): void {
    if (!this.deps.canOpen() || this.phoneOpen) return;
    this.phoneOpen = true;
    patchUi(this.deps.ui, { phoneOpen: true, prompt: null });
    this.deps.audio.play("ui-select");
    this.deps.focus.panel();
  }

  closePhone(): void {
    if (!this.phoneOpen) return;
    this.phoneOpen = false;
    patchUi(this.deps.ui, { phoneOpen: false });
    this.deps.focus.settle();
  }

  readThread(from: string): void {
    this.deps.readThread(from);
  }

  /** Closes the phone without moving the pointer. */
  closeSilently(): void {
    this.phoneOpen = false;
    patchUi(this.deps.ui, { phoneOpen: false });
  }
}
