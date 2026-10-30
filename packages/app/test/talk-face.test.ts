import { describe, expect, it } from "vitest";
import { type EffectDescriptor, EMPTY_INPUT, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { nearKaito } from "./story-helpers";
import { GameSession } from "../src/game-session";

const audio = { play() {}, stopAll() {} };

describe("the conversation partner's mouth moves (face expressions)", () => {
  it("sends a talk effect to the NPC for each of its lines and stops it when the talk closes", () => {
    const effects: EffectDescriptor[] = [];
    const render: RenderPort = {
      spawn() {},
      updateTransform() {},
      despawn() {},
      clear() {},
      setCameraMode() {},
      attachCamera() {},
      playEffect: (e) => effects.push(e),
      setAppearance() {},
    };
    const ui = createUiStore();
    const session = new GameSession({ render, audio, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 7, now: () => new Date(2026, 9, 27, 21, 0) });
    session.newGame();
    const player = session.sim.player()!;
    const [x, z, yaw] = nearKaito(session);
    player.position = { x, y: 0, z };
    player.prevPosition = player.position;
    player.yaw = yaw;
    session.step(EMPTY_INPUT);
    session.step({ ...EMPTY_INPUT, interact: true });
    expect(ui.getState().dialogue).not.toBeNull();
    const kaito = [...session.sim.world].find((e) => e.key === "fixer")!;
    const talks = () => effects.filter((e): e is Extract<EffectDescriptor, { kind: "talk" }> => e.kind === "talk");
    expect(talks()[0]).toMatchObject({ entityId: kaito.id });
    expect(talks()[0]!.seconds).toBeGreaterThan(0.5);
    session.intents.choose(0);
    expect(talks().length).toBeGreaterThan(1);
    session.intents.closeDialogue();
    expect(talks().at(-1)).toEqual({ kind: "talk", entityId: kaito.id, seconds: 0 });
  });
});
