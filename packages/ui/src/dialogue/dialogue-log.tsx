import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n/use-t";
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
 * Subtitles at the bottom of the screen (ADR-0039): only the lines of the last step, read from
 * the top (G-283: a log of the whole talk that jumped to its end at every step pulled the eye
 * away from what was just said). The earlier lines open behind a button until the next step.
 */
export const DialogueLog = ({ history, lines }: { history: readonly DialogueLineVm[]; lines: readonly DialogueLineVm[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const [openAt, setOpenAt] = useState<readonly DialogueLineVm[] | null>(null);
  const open = openAt === lines && history.length > 0;
  // Asked for by the player: land on the newest earlier line, just above the current ones.
  useLayoutEffect(() => {
    const last = open ? [...(ref.current?.querySelectorAll<HTMLElement>(".subs__line--past") ?? [])].at(-1) : undefined;
    if (ref.current && last) ref.current.scrollTop = last.offsetTop + last.offsetHeight - ref.current.clientHeight;
  }, [open]);
  return (
    <div className="subs" ref={ref} data-dialogue-log="" role="log" aria-label={t("dialogue.log")} tabIndex={-1}>
      {history.length > 0 && (
        <button type="button" className="subs__history" aria-expanded={open} onClick={() => setOpenAt(open ? null : lines)}>
          {t("dialogue.history")}
        </button>
      )}
      {open && history.map((l, i) => <Line key={`h${i}`} line={l} past />)}
      {lines.map((l, i) => (
        <Line key={`n${history.length + i}`} line={l} past={false} />
      ))}
    </div>
  );
};
