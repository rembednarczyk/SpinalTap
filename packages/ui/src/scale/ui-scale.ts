/**
 * The interface scale (ADR-0085): one place turns the player's HUD scale setting, the screen and
 * its safe area into the scale every overlay layer draws at. Pure, so the rule is tested on its own.
 */

export interface ScreenBox {
  readonly width: number;
  readonly height: number;
}

/** Insets of the screen's safe area in CSS px (the notch, the rounded corners, the home bar). */
export interface SafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const NO_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The scales the layers draw at: `ui` for the HUD, messages, cards and the dialogue; `touch` lays
 * the on-screen pad out (where its targets sit and how much they take), and `touchLook` draws its
 * buttons and stick within that, so on screen they look `ui` large.
 */
export interface UiScale {
  readonly ui: number;
  readonly touch: number;
  readonly touchLook: number;
}

/**
 * The smallest screen each layout fits at scale 1, safe area taken off: the compact one of a phone
 * held sideways (the layout specs check 667x375 and 800x370) and the desktop one (1024x600, the
 * smallest size the desktop layout spec checks). A scale above 1 never shrinks the HUD's room below it.
 */
export const COMPACT_ROOM: ScreenBox = { width: 667, height: 370 };
export const DESKTOP_ROOM: ScreenBox = { width: 1024, height: 600 };

/**
 * The pad never lays its targets out smaller than at scale 1: its smallest target is 44 px there,
 * the least a thumb hits reliably (ADR-0035), and the targets keep their places. Below 1 only the
 * drawing shrinks (`touchLook`); an unseen margin keeps each target `MIN_HIT_PX` (ADR-0085).
 */
export const MIN_TOUCH_SCALE = 1;
export const MIN_HIT_PX = 44;

/** The compact layout's screens, as the styles' `(max-height: 500px), (max-width: 760px)`. */
export const isCompact = (screen: ScreenBox): boolean => screen.height <= 500 || screen.width <= 760;

const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The scale the layers draw at. Below 1 the setting holds as it is: everything shrinks toward its
 * own screen edge and frees room. Above 1 it holds while the layout still has the room it needs at
 * scale 1 (`COMPACT_ROOM` or `DESKTOP_ROOM`, within the safe area); beyond that it stops there, never
 * under 1. The pad is laid out at the same scale, never under `MIN_TOUCH_SCALE`, and drawn at `ui`.
 */
export const uiScale = (setting: number, screen: ScreenBox, safe: SafeArea = NO_SAFE_AREA, touch = false): UiScale => {
  const asked = Number.isFinite(setting) && setting > 0 ? setting : 1;
  const room = isCompact(screen) ? COMPACT_ROOM : DESKTOP_ROOM;
  const width = screen.width - safe.left - safe.right;
  const height = screen.height - safe.top - safe.bottom;
  const fits = Math.min(width / room.width, height / room.height);
  const ui = asked <= 1 ? asked : Math.max(1, Math.min(asked, fits));
  const pad = touch ? Math.max(MIN_TOUCH_SCALE, ui) : ui;
  return { ui: round(ui), touch: round(pad), touchLook: round(ui / pad) };
};
