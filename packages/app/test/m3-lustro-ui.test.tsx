// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountGame, run, unmountGame } from "./game-ui";

/** Act II's key conversation through the dialogue UI (formerly e2e/m3-lustro.spec.ts, ADR-0046). */
afterEach(unmountGame);

describe("act II on the overpass in the game", () => {
  it("Kurosawa's deal on the overpass ends act II and Kagami's copy plays", () => {
    const g = mountGame({ seed: 11 });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    expect(screen.getByTestId("hud")).toBeTruthy();

    // Straight to the last step of act II, after the "aya" ending, Kaito's job taken.
    run(() =>
      g.seki.jump({
        quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex: 3 } },
        story: { choices: { case: "opened", name: "spoken", crash: "wheel", rooftop: "together", job: "taken", voice: "listened" }, ending: "aya", act2Ending: null },
        flags: ["act1_ending", "ending:aya", "kagami_job", "met_fixer", "met_ren", "recalled:last_call", "recalled:rooftop", "ren_trail", "reported_back", "seen:act2_opening"],
      }),
    );
    expect(g.seki.state().objective).toContain("Kurosawa from Kagami is waiting on the viaduct");

    // On the viaduct's deck over aleja Tysiąclecia, next to him; a step streams the market in.
    run(() => {
      const p = g.seki.place("market", 98.5, 9.9, 92);
      g.seki.teleport(p.x, p.z, Math.PI / 2, 0, p.y);
    });
    g.step(2);
    const prompt = () => screen.queryByTestId("prompt")?.textContent ?? "";
    for (let i = 0; i < 120 && !prompt().includes("Kurosawą"); i++) g.step(1);
    expect(prompt()).toContain("Kurosawą");
    g.step(1, { interact: true });

    const dialogue = () => screen.getByTestId("dialogue");
    expect(dialogue().textContent).toContain("dział odzysku");
    expect(dialogue().textContent).toContain("przyjęła pani zlecenie");
    fireEvent.click(within(dialogue()).getByRole("button", { name: /Bierzcie Rena i archiwum/ }));
    expect(dialogue().textContent).toContain("chip w białym etui");
    fireEvent.click(within(dialogue()).getByRole("button", { name: /End conversation/ }));
    g.step(2);

    expect(screen.getByText("End of Act II: Lustro")).toBeTruthy();
    expect(g.seki.state().flags).toEqual(expect.arrayContaining(["act2_ending", "ending:kagami"]));
    // The recording from Kagami plays on its own as a flashback.
    expect(dialogue().textContent).toContain("Wszystko się zgadza.");
  });
});
