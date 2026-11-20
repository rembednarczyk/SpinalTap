/**
 * v50 -> v51 (ADR-0095): act III of the main thread. The story gets its act-III ending (none yet),
 * and a save with act II over starts "Źródło" at its first step, as the sim starts it after "Lustro".
 * Ids are spelled out: a migration describes the schema of its time, not today's content.
 */
type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export const startActThree = (old: Json): Json => {
  const domain = isObject(old.domain) ? old.domain : {};
  const story = isObject(domain.story) ? domain.story : {};
  const quests = isObject(domain.quests) ? domain.quests : {};
  const mirror = quests.m3_lustro;
  const start = isObject(mirror) && mirror.status === "completed" && !("m3_zrodlo" in quests);
  return {
    ...old,
    version: 51,
    domain: {
      ...domain,
      story: { ...story, act3Ending: "act3Ending" in story ? story.act3Ending : null },
      quests: start ? { ...quests, m3_zrodlo: { status: "active", stepIndex: 0 } } : quests,
    },
  };
};
