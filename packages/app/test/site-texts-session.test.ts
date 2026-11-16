import { describe, expect, it } from "vitest";
import type { AudioPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { LUBLIN_CONSTRUCTION_SITES } from "@seki/sim/lublin";
import { DEFAULT_SETTINGS, createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { siteBoardTexts } from "../src/presenters/site-texts";
import { FakeRender } from "./story-helpers";

/** The fake renderer holding the building sites' texts, as the engine's does: it records what reaches it. */
class SiteRender extends FakeRender {
  readonly sent: Readonly<Record<string, string>>[] = [];
  readonly siteTexts = { set: (texts: Readonly<Record<string, string>>) => void this.sent.push(texts) };
}

const audio: AudioPort = { play() {}, stopAll() {} };

const start = (locale: "en" | "pl" = "en") => {
  const render = new SiteRender();
  const ui = createUiStore();
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 16),
    settings: { applied: { ...DEFAULT_SETTINGS, locale }, save: () => {}, reload: () => {} },
  });
  return { session, render };
};

/** The building sites' boards in the player's language (ADR-0087 stage 2, ADR-0056). */
describe("the building sites' board texts in the session", () => {
  const zielona = LUBLIN_CONSTRUCTION_SITES.find((s) => s.id === "w770678456")!;

  it("hands every board's texts to the renderer at the start, in the language of the options", () => {
    const { render } = start();
    expect(render.sent).toHaveLength(1);
    const texts = render.sent[0]!;
    for (const key of [zielona.board!.name, zielona.board!.developer, zielona.board!.term]) expect(texts[key], key).toMatch(/\S/);
    expect(texts[zielona.board!.developer]).toMatch(/^Developer: /);
    expect(start("pl").render.sent[0]![zielona.board!.developer]).toMatch(/^Deweloper: /);
  });

  it("hands them over again when the language changes, and only then", () => {
    const { session, render } = start();
    session.intents.changeSettings({ volume: 0.5 });
    expect(render.sent).toHaveLength(1);
    session.intents.changeSettings({ locale: "pl" });
    expect(render.sent).toHaveLength(2);
    expect(render.sent[1]).toEqual(siteBoardTexts("pl"));
    expect(render.sent[1]![zielona.board!.term]).not.toBe(render.sent[0]![zielona.board!.term]);
  });

  it("leaves a renderer without the sites' texts alone", () => {
    const render = new FakeRender();
    expect(() =>
      new GameSession({
        render,
        audio,
        persistence: new SavePersistence(new MemorySaveStore()),
        ui: createUiStore(),
        story: STORY_SOURCE,
        seed: () => 77,
        now: () => new Date(2026, 10, 16),
        settings: { applied: DEFAULT_SETTINGS, save: () => {}, reload: () => {} },
      }),
    ).not.toThrow();
  });
});
