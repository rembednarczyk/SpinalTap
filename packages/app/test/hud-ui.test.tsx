// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountGame, run, unmountGame } from "./game-ui";

/**
 * The wave 1 and wave 2 HUD (ADR-0028, ADR-0035) on the real UI, driven through the debug API
 * as the hud-wave1 and hud-wave2 e2e specs did: events the simulation does not send yet go on
 * the bus from the test. Moved out of the browser by ADR-0046.
 */
const start = () => {
  const game = mountGame({ seed: 7 });
  fireEvent.click(screen.getByRole("button", { name: "Nowa gra" }));
  game.step(1);
  return game;
};

const key = (code: string) => fireEvent.keyDown(window, { code });

afterEach(unmountGame);

describe("wave 1 HUD in the game", () => {
  it("phone, debrief card and breach from the debug API", () => {
    const { seki, session } = start();
    expect(screen.getByTestId("hud")).toBeTruthy();

    // A contract text lands as a notification and in the inbox; T opens the phone.
    run(() => seki.emit("PhoneMessage", { from: "oyaji", kind: "text", knot: "oyaji_closed", priority: "contract" }));
    expect(screen.getByTestId("phone-notice").textContent).toContain("Oyaji");
    key("KeyT");
    expect(screen.getByTestId("phone")).toBeTruthy();
    expect(screen.getByTestId("phone-thread").textContent).toContain("Wróć po ósmej");
    expect(session.inControl).toBe(false);
    key("KeyT");
    expect(screen.queryByTestId("phone")).toBeNull();
    expect(session.inControl).toBe(true);

    // The debrief card after a paid contract.
    run(() => {
      seki.emit("ContractCompleted", { contract: { id: "c9", kind: "infiltrate", siteId: "car_wash", targets: 2, reward: 1200, status: "cleared" }, reward: 1200 } as never);
      seki.emit("ContractDebrief", { contractId: "c9", badges: ["ghost", "no_alarm", "untouched", "netrunner"], rank: "S", reward: 1200, bonus: 300, styleBonus: 150, seconds: 254 });
    });
    expect(screen.getByTestId("debrief").textContent).toContain("Infiltracja");
    expect(screen.getByTestId("debrief-rank").textContent).toContain("S");
    expect(screen.getByTestId("debrief-total").textContent).toContain("1650");
    key("Enter");
    expect(screen.queryByTestId("debrief")).toBeNull();

    // The breach minigame: auto-solve sends one daemon and gives the controls back.
    run(() => seki.breach("crane"));
    const breach = screen.getByTestId("breach");
    expect(within(breach).getAllByRole("gridcell")).toHaveLength(25);
    expect(session.inControl).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Autorozwiązanie (1 demon)" }));
    expect(screen.queryByTestId("breach")).toBeNull();
    expect(session.inControl).toBe(true);
  });
});

describe("wave 2 HUD in the game", () => {
  it("metro, radio and the wave 2 badges from the debug API", () => {
    const { seki, ui } = start();

    // The kiosk's line map, left with Esc.
    run(() => seki.metro("shinsekai"));
    expect(screen.getByTestId("metro-map")).toBeTruthy();
    expect(screen.getByTestId("metro-stop-shinsekai").textContent).toContain("Jesteś tutaj");
    key("Escape");
    expect(screen.queryByTestId("metro-map")).toBeNull();

    // The ride with an ink subtitle, until the train arrives.
    run(() => seki.emit("MetroDeparted", { from: "shinsekai", to: "doki", seconds: 6 }));
    expect(screen.getByTestId("metro-ride").textContent).toContain("Nabrzeże Bystrzycy");
    expect(screen.getByTestId("metro-caption").textContent).not.toBe("");
    run(() => seki.emit("MetroArrived", { station: "doki" }));
    expect(screen.queryByTestId("metro-ride")).toBeNull();

    // B tunes the radio; the phone shows the station picked.
    key("KeyB");
    key("KeyT");
    expect(screen.getByTestId("radio-drift").getAttribute("aria-checked")).toBe("true");
    expect(ui.getState().settings.radioStation).toBe("drift");
    key("KeyT");
    expect(screen.queryByTestId("phone")).toBeNull();

    // Buffs and the disguise are read from the domain: a game with them, as a load would bring it.
    // No step after it: the simulation recomputes the disguise from the clothes worn.
    run(() => seki.jump({ buffs: [{ id: "regen", left: 30 }], disguise: { role: "tessen_guard", blown: false } }));
    expect(screen.getByTestId("buff-regen")).toBeTruthy();
    expect(screen.getByTestId("disguise").textContent).toContain("ochrona Tessen");
    run(() => seki.jump({ disguise: { role: "tessen_guard", blown: true } }));
    expect(screen.getByTestId("disguise").textContent).toContain("Spalona przykrywka");
  });
});
