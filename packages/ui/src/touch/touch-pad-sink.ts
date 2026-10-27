export type TouchButton = "fire" | "aim" | "interact" | "jump" | "ability" | "useItem" | "toggleCamera" | "sprint" | "toggleWeapon" | "crouch" | "reload";

/** Where the on-screen controls send input. Implemented by the engine's VirtualPad. */
export interface TouchPadSink {
  setStick(x: number, z: number): void;
  look(yaw: number, pitch: number): void;
  press(button: TouchButton): void;
  release(button: TouchButton): void;
  /** A tap on a weapon slot of the HUD strip: 1 primary, 2 secondary, 3 melee. */
  selectWeaponSlot(slot: 1 | 2 | 3): void;
  reset(): void;
}
