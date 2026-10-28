import { useEffect, useRef } from "react";
import type { DialogueLineVm } from "../store/ui-vm";

const Line = ({ line, past }: { line: DialogueLineVm; past: boolean }) => {
  const kind = line.speaker ? "subs__line" : "subs__line subs__line--narration";
  return (
    <p className={past ? `${kind} subs__line--past` : kind}>
      {line.speaker && <span className="subs__speaker">{line.speaker}</span>}
      {line.text}
    </p>
  );
};

/**
 * Subtitles at the bottom of the screen (ADR-0039): the lines of the last step, with the earlier
 * ones of the same conversation above them, dimmed. The log scrolls (wheel, finger, keys) and
 * jumps to the newest line at every step.
 */
export const DialogueLog = ({ history, lines }: { history: readonly DialogueLineVm[]; lines: readonly DialogueLineVm[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <div className="subs" ref={ref} data-dialogue-log="" role="log" aria-label="Rozmowa" tabIndex={-1}>
      {history.map((l, i) => (
        <Line key={`h${i}`} line={l} past />
      ))}
      {lines.map((l, i) => (
        <Line key={`n${history.length + i}`} line={l} past={false} />
      ))}
    </div>
  );
};
