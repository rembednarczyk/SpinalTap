import type { Message } from "../message";

/** English texts of the end screen after the main thread's epilogue (ADR-0095 stage 2). */
export const enEnding = {
  "endScreen.heading": "The end of the main thread",
  "endScreen.lead": "Lublin goes on, and so do you. Kaito has jobs waiting.",
  "endScreen.act1": "Act I: Echo",
  "endScreen.act2": "Act II: Lustro",
  "endScreen.act3": "Act III: Źródło",
  "endScreen.choices": "Your choices",
  "endScreen.level": "Level {level}",
  "endScreen.contracts": { one: "{count} contract done", other: "{count} contracts done" },
  "endScreen.memories": { one: "{count} memory recovered", other: "{count} memories recovered" },
  "endScreen.back": "Back to the city",
  // The main thread's choices, as the end screen sums them up: what Seki did.
  "story.choice.case.opened": "You opened the Kagami case.",
  "story.choice.case.sealed": "You left the Kagami case sealed.",
  "story.choice.name.spoken": "You told the technician your name.",
  "story.choice.name.silent": "You kept your name to yourself.",
  "story.choice.crash.wheel": "You crashed the car yourself.",
  "story.choice.crash.ren": "You followed Ren's voice on the comm.",
  "story.choice.rooftop.together": "You took the Kagami run with Ren.",
  "story.choice.rooftop.alone": "You took the Kagami run alone.",
  "story.choice.voice.listened": "You kept listening to the voice behind Ren's.",
  "story.choice.voice.torn": "You tore the earpiece out.",
  "story.choice.job.refused": "You turned down Kaito's job on Ren.",
  "story.choice.job.taken": "You took Kaito's job on Ren.",
  "story.choice.archive.street": "You gave the archive back to the street.",
  "story.choice.archive.hebi": "You gave the archive to Ren and Hebi.",
  "story.choice.archive.kagami": "You traded the archive to Kagami for your own recording.",
  "story.choice.core.erase": "You wiped the core, Aya's original with it.",
  "story.choice.core.release": "You let the archive out on the city's net.",
  "story.choice.core.keep": "You stayed by the core to decide who gets what back.",
} as const satisfies Readonly<Record<string, Message>>;

export type EndingKey = keyof typeof enEnding;
