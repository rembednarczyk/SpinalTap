// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ContractDebriefVm,
  DEFAULT_SETTINGS,
  GameUi,
  type MapVm,
  type PhoneMessageVm,
  type UiIntents,
  type UiState,
  createUiStore,
  patchUi,
  quickhacksFor,
} from "../src";
import { RESERVED_KEYS } from "../src/menus/key-label";
import { formatSeconds } from "../src/hud/contract-card";

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={i} touch={touch ? pad : undefined} />);
  return { store, i };
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const message = (over: Partial<PhoneMessageVm> = {}): PhoneMessageVm => ({
  id: 1,
  from: "kaito",
  contact: "Kaito",
  kind: "text",
  priority: "contract",
  lines: [{ speaker: "Kaito", text: "Mam robotę w porcie." }],
  time: "22:10",
  ...over,
});

describe("phone", () => {
  it("shows a holocall with the caller's portrait and the caption", () => {
    mount({ phoneNotice: { holocall: true, message: message({ priority: "story", kind: "call", contact: "Hana Ito", lines: [{ speaker: "Hana Ito", text: "Seki, uciekaj." }] }) } });
    const call = screen.getByTestId("holocall");
    expect(call.textContent).toContain("Holocall");
    expect(call.textContent).toContain("HI");
    expect(call.textContent).toContain("Seki, uciekaj.");
    expect(screen.queryByTestId("phone-notice")).toBeNull();
  });

  it("shows a quiet notification with the first line and the key", () => {
    mount({ phoneNotice: { holocall: false, message: message() } });
    const n = screen.getByTestId("phone-notice");
    expect(n.textContent).toContain("Kaito");
    expect(n.textContent).toContain("Mam robotę w porcie.");
    expect(n.querySelector("kbd")?.textContent).toBe("T");
  });

  it("opens on T, lists a thread per contact and marks the shown one read", () => {
    const threads = [
      { from: "hana", contact: "Hana", unread: 0, messages: [message({ id: 2, from: "hana", contact: "Hana", priority: "info", lines: [{ speaker: null, text: "Targ zamknięty." }] })] },
      { from: "kaito", contact: "Kaito", unread: 1, messages: [message()] },
    ];
    const { store, i } = mount({ phone: { threads, unread: 1 } });
    fireEvent.keyDown(window, { code: "KeyT" });
    expect(i.openPhone).toHaveBeenCalled();
    act(() => patchUi(store, { phoneOpen: true }));
    const phone = screen.getByTestId("phone");
    expect(within(phone).getAllByRole("tab")).toHaveLength(2);
    expect(within(phone).getByTestId("phone-thread").textContent).toContain("Targ zamknięty.");
    fireEvent.click(within(phone).getByRole("tab", { name: /Kaito/ }));
    expect(within(phone).getByTestId("phone-thread").textContent).toContain("Mam robotę w porcie.");
    expect(i.readThread).toHaveBeenCalledWith("kaito");
    fireEvent.keyDown(window, { code: "Escape" });
    expect(i.closePhone).toHaveBeenCalled();
  });

  it("does not open over a conversation, and says when it is empty", () => {
    const { store, i } = mount({ dialogue: { lines: [], choices: [], ended: false } });
    fireEvent.keyDown(window, { code: "KeyT" });
    expect(i.openPhone).not.toHaveBeenCalled();
    act(() => patchUi(store, { dialogue: null, phoneOpen: true }));
    expect(screen.getByTestId("phone").textContent).toContain("No messages");
    fireEvent.keyDown(window, { code: "KeyT" });
    expect(i.closePhone).toHaveBeenCalled();
  });

  it("keeps T off the key bindings", () => {
    expect(RESERVED_KEYS.has("KeyT")).toBe(true);
  });
});

const debrief: ContractDebriefVm = {
  contractId: "c4",
  title: "Infiltracja",
  fixer: "Genzō",
  badges: [
    { id: "ghost", earned: true, style: true },
    { id: "no_alarm", earned: true, style: false },
    { id: "clean", earned: false, style: true },
    { id: "untouched", earned: true, style: false },
    { id: "swift", earned: false, style: false },
    { id: "netrunner", earned: true, style: false },
  ],
  rank: "S",
  reward: 1200,
  bonus: 300,
  styleBonus: 150,
  seconds: 254,
};

describe("contract debrief", () => {
  it("shows rank, badges with icons and Polish labels, the pay split and the time", () => {
    const { i } = mount({ debrief });
    const card = screen.getByTestId("debrief");
    expect(screen.getByTestId("debrief-rank").textContent).toContain("S");
    expect(screen.getByTestId("badge-ghost").className).toContain("debrief__badge--earned");
    expect(screen.getByTestId("badge-ghost").className).toContain("debrief__badge--style");
    expect(screen.getByTestId("badge-ghost").textContent).toContain("Duch");
    expect(screen.getByTestId("badge-ghost").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("badge-clean").className).not.toContain("earned");
    expect(screen.getByTestId("badge-netrunner").textContent).toContain("Netrunner");
    expect(card.textContent).toContain("Bonus za styl (Genzō)");
    expect(screen.getByTestId("debrief-total").textContent).toMatch(/1\s?650/);
    expect(card.textContent).toContain("4:14");
    fireEvent.keyDown(window, { code: "Enter" });
    expect(i.dismissDebrief).toHaveBeenCalled();
  });

  it("waits for the conversation to end and closes itself after a while", () => {
    vi.useFakeTimers();
    const { store, i } = mount({ debrief: { ...debrief, bonus: 0, styleBonus: 0, fixer: null, rank: "C" }, dialogue: { lines: [], choices: [], ended: true } });
    expect(screen.queryByTestId("debrief")).toBeNull();
    act(() => patchUi(store, { dialogue: null }));
    expect(screen.getByTestId("debrief").textContent).toContain("—");
    act(() => vi.advanceTimersByTime(16000));
    expect(i.dismissDebrief).toHaveBeenCalled();
  });

  it("formats seconds as minutes", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65.4)).toBe("1:05");
    expect(formatSeconds(-3)).toBe("0:00");
  });

  it("marks the condition bonus by the objective as kept or lost", () => {
    const { store } = mount({ objective: "Skopiuj dane", questTitle: "Infiltracja", contractBonus: { label: "Nie podnoś alarmu", badge: "no_alarm", bonus: 300, kept: true } });
    expect(screen.getByTestId("contract-bonus").textContent).toContain("✓");
    act(() => patchUi(store, { contractBonus: { label: "Nie podnoś alarmu", badge: "no_alarm", bonus: 300, kept: false } }));
    expect(screen.getByTestId("contract-bonus").className).toContain("hud__bonus--lost");
    expect(screen.getByTestId("contract-bonus").getAttribute("aria-label")).toContain("stracony");
  });
});

const map: MapVm = { bounds: { x: 0, z: 0, w: 100, d: 100 }, blocks: [], streets: [] };

describe("heat and detection", () => {
  it("shows the heat stars, dim while searching and blinking before the drop", () => {
    const { store } = mount({ heat: { level: 2, searching: false, ending: false } });
    const heat = screen.getByTestId("heat");
    expect(heat.querySelectorAll(".heat__star--on")).toHaveLength(2);
    expect(heat.getAttribute("aria-label")).toBe("Pościg: 2 z 3");
    act(() => patchUi(store, { heat: { level: 2, searching: true, ending: true } }));
    expect(screen.getByTestId("heat").className).toContain("heat--searching");
    expect(screen.getByTestId("heat").className).toContain("heat--ending");
    act(() => patchUi(store, { heat: { level: 0, searching: false, ending: false } }));
    expect(screen.queryByTestId("heat")).toBeNull();
  });

  it("puts an arc round the crosshair per observer, by state, with a glyph", () => {
    mount({
      detection: [
        { id: 4, angle: 0, level: 0.5, state: "suspicious" },
        { id: 5, angle: Math.PI / 2, level: 1, state: "alerted" },
      ],
    });
    expect(screen.getByTestId("detection-suspicious").textContent).toContain("?");
    expect(screen.getByTestId("detection-alerted").textContent).toContain("!");
  });

  it("marks calling witnesses and the last known position on the minimap", () => {
    mount({ map, mapPlayer: { x: 0, z: 0, yaw: 0 }, witnesses: [{ id: "w9", x: 5, z: 5 }], lastKnown: { x: -4, z: 2 } });
    expect(screen.getByTestId("minimap-witness")).toBeTruthy();
    expect(screen.getByTestId("minimap-last-known").getAttribute("transform")).toBe("translate(-4.00 -2.00)");
  });
});

describe("scanner", () => {
  const target = { id: 12, kind: "person" as const, name: "Akira Tanaka", faction: "Mieszkańcy Lublina", profile: ["Kurier dronów", "Dochód: 900 €$/mies."], hostile: false };

  it("lists the target's quickhacks with numbers and RAM, and the RAM bar", () => {
    mount({ scanning: true, scanTarget: target, ram: { current: 3, max: 8 } });
    expect(screen.getByTestId("scanner").textContent).toContain("KIROSHI");
    const card = screen.getByTestId("scan-card");
    expect(card.textContent).toContain("Akira Tanaka");
    expect(card.textContent).toContain("Kurier dronów");
    expect(quickhacksFor("person")).toEqual(["ping", "reboot_optics", "cripple_movement", "short_circuit"]);
    expect(screen.getByTestId("hack-ping").textContent).toContain("1");
    expect(screen.getByTestId("hack-ping").textContent).toContain("2 RAM");
    expect(screen.getByTestId("hack-short_circuit").className).toContain("hacks__row--short");
    expect(screen.getByTestId("ram").getAttribute("aria-label")).toBe("RAM 3 z 8");
  });

  it("devices and cameras get their own lists", () => {
    expect(quickhacksFor("device")).toEqual(["ping", "distract", "short_circuit"]);
    expect(quickhacksFor("camera")).toEqual(["ping", "reboot_optics"]);
  });

  it("says when nothing is in focus, and hides without the scanner", () => {
    const { store } = mount({ scanning: true });
    expect(screen.getByText("Brak celu w polu skanu")).toBeTruthy();
    act(() => patchUi(store, { scanning: false }));
    expect(screen.queryByTestId("scanner")).toBeNull();
    expect(screen.queryByTestId("ram")).toBeNull();
  });

  it("keeps the upload bar and the notes after the scanner is let go", () => {
    mount({ scanning: false, upload: { seq: 1, hackId: "reboot_optics", seconds: 1 }, scanNote: { seq: 1, tone: "traced", text: "Namierzono cię!" } });
    expect(screen.getByTestId("upload").textContent).toContain("Restart optyki");
    expect(screen.getByTestId("ram")).toBeTruthy();
    expect(screen.getByTestId("scan-note").className).toContain("scan-note--traced");
  });

  it("on touch: the scanner button toggles it and a tap on a hack uploads it", () => {
    const { store, i } = mount({ scanTarget: target, ram: { current: 8, max: 8 } }, true);
    fireEvent.pointerDown(screen.getByTestId("touch-scan"));
    expect(i.setScan).toHaveBeenCalledWith(true);
    act(() => patchUi(store, { scanning: true }));
    fireEvent.click(screen.getByRole("button", { name: "Paraliż ruchu, 4 RAM" }));
    expect(i.pickQuickhack).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTestId("touch-phone"));
    expect(i.openPhone).toHaveBeenCalled();
  });
});

describe("combat feedback and the contextual HUD", () => {
  it("shows a kill marker and a critical one", () => {
    const { store } = mount();
    act(() => patchUi(store, { hitMarker: 1, hitZone: "torso", hitKind: "kill" }));
    expect(screen.getByTestId("hit-kill")).toBeTruthy();
    act(() => patchUi(store, { hitMarker: 2, hitKind: "crit" }));
    expect(screen.getByTestId("crosshair").className).toContain("crosshair--crit");
  });

  it("shows damage numbers only when the setting asks for them", () => {
    const { store } = mount({ damageNumbers: [{ id: 1, amount: 24.4, critical: true, rev: 0 }] });
    expect(screen.queryByTestId("damage-numbers")).toBeNull();
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, damageNumbers: "hit" } }));
    expect(screen.getByTestId("damage-numbers").textContent).toBe("24");
  });

  it("hides health and ammo at full health out of combat, unless always shown", () => {
    const weapons = {
      slots: [{ slot: "secondary" as const, key: 2 as const, name: "Unity-9", rarity: null }],
      active: "secondary" as const,
      loaded: 12,
      magazine: 12,
      reserve: 30,
      ammoName: "9 mm",
      reloading: false,
      holstered: false,
    };
    const { store } = mount({ hp: 100, maxHp: 100, weapons });
    expect(screen.getByTestId("identity").className).toContain("hud__identity--calm");
    expect(screen.getByTestId("weapon-ammo").className).toContain("weapon-strip__ammo--calm");
    act(() => patchUi(store, { combat: true }));
    expect(screen.getByTestId("identity").className).not.toContain("calm");
    expect(screen.getByTestId("weapon-ammo").className).not.toContain("calm");
    act(() => patchUi(store, { combat: false, hp: 60 }));
    expect(screen.getByTestId("identity").className).not.toContain("calm");
    act(() => patchUi(store, { hp: 100, settings: { ...DEFAULT_SETTINGS, hudAlwaysShow: true } }));
    expect(screen.getByTestId("identity").className).not.toContain("calm");
  });
});

describe("accessibility", () => {
  it("has its own settings tab and sends the changes", () => {
    const { i } = mount({ screen: "paused" });
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByRole("tab", { name: "Accessibility" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Reduce flashes and glitch effects" })).getByRole("radio", { name: "On" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ reduceFlashes: true });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Untimed breach minigame" })).getByRole("radio", { name: "On" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ untimedBreach: true });
    fireEvent.click(screen.getByRole("radio", { name: "Deuteranopia" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ colorblind: "deutan" });
    fireEvent.change(screen.getByLabelText(/HUD scale/), { target: { value: "1.2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ hudScale: 1.2 });
    // Every colour token comes with its icon.
    expect(screen.getByTestId("token-legend").textContent).toContain("▲Threat");
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    fireEvent.click(screen.getByRole("radio", { name: "Running total" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ damageNumbers: "total" });
  });

  it("puts scale, font, flashes and palette on the document root", () => {
    const { store } = mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 1.25, legibleFont: true, reduceFlashes: true, colorblind: "tritan" } });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hud-scale")).toBe("1.25");
    expect(root.classList.contains("legible-font")).toBe(true);
    expect(root.classList.contains("reduce-flashes")).toBe(true);
    expect(root.dataset.palette).toBe("tritan");
    act(() => patchUi(store, { settings: DEFAULT_SETTINGS }));
    expect(root.classList.contains("legible-font")).toBe(false);
    expect(root.dataset.palette).toBeUndefined();
  });
});
