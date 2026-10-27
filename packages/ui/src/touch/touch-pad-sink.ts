export type TouchButton = "fire" | "interact" | "ability" | "useItem" | "toggleCamera" | "sprint" | "toggleWeapon" | "crouch";

/** Where the on-screen controls send input. Implemented by the engine's VirtualPad. */
export interface TouchPadSink {
  setStick(x: number, z: number): void;
  look(yaw: number, pitch: number): void;
  press(button: TouchButton): void;
  release(button: TouchButton): void;
  reset(): void;
}
