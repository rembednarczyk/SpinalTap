import { useEffect } from "react";
import { useIntents, useUi } from "../use-ui";

export const DialoguePanel = () => {
  const dialogue = useUi((s) => s.dialogue);
  const intents = useIntents();

  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      const choice = dialogue.choices[n - 1];
      if (choice) intents.choose(choice.index);
      else if (dialogue.ended && (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E")) intents.closeDialogue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogue, intents]);

  if (!dialogue) return null;
  return (
    <div className="dialogue" data-testid="dialogue">
      <div className="dialogue__lines">
        {dialogue.lines.map((l, i) => (
          <p key={i} className={l.speaker ? "dialogue__line" : "dialogue__line dialogue__line--narration"}>
            {l.speaker && <span className="dialogue__speaker">{l.speaker}</span>}
            {l.text}
          </p>
        ))}
      </div>
      <div className="dialogue__choices">
        {dialogue.choices.map((c, i) => (
          <button key={c.index} type="button" className="dialogue__choice" onClick={() => intents.choose(c.index)}>
            <span className="dialogue__key">{i + 1}</span> {c.text}
          </button>
        ))}
        {dialogue.ended && (
          <button type="button" className="dialogue__choice dialogue__choice--end" onClick={() => intents.closeDialogue()}>
            <span className="dialogue__key">E</span> Zakończ rozmowę
          </button>
        )}
      </div>
    </div>
  );
};
