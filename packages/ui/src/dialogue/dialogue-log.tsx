import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * Subtitles (ADR-0039): only the lines of the last step, read from the top (G-283: a log of the
 * whole talk that jumped to its end at every step pulled the eye away from what was just said).
 * The earlier lines open behind a button until the next step. A step too long for the box shows
 * an arrow until it is scrolled to its end.
 */
export const DialogueLog = ({ history, lines }: { history: readonly DialogueLineVm[]; lines: readonly DialogueLineVm[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const [openAt, setOpenAt] = useState<readonly DialogueLineVm[] | null>(null);
  const [more, setMore] = useState(false);
  const open = openAt === lines && history.length > 0;
  const measure = useCallback(() => {
    const el = ref.current;
    setMore(el !== null && el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);
  // Asked for by the player: land on the newest earlier line, just above the current ones.
  useLayoutEffect(() => {
    const last = open ? [...(ref.current?.querySelectorAll<HTMLElement>(".subs__line--past") ?? [])].at(-1) : undefined;
    if (ref.current && last) ref.current.scrollTop = last.offsetTop + last.offsetHeight - ref.current.clientHeight;
    measure();
  }, [open, lines, measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  return (
    <div className="subs">
      {history.length > 0 && (
        <button type="button" className="subs__history" aria-expanded={open} onClick={() => setOpenAt(open ? null : lines)}>
          {t("dialogue.history")}
        </button>
      )}
      <div className="subs__scroll" ref={ref} onScroll={measure} data-dialogue-log="" role="log" aria-label={t("dialogue.log")} tabIndex={-1}>
        {open && history.map((l, i) => <Line key={`h${i}`} line={l} past />)}
        {lines.map((l, i) => (
          <Line key={`n${history.length + i}`} line={l} past={false} />
        ))}
      </div>
      {more && (
        <div className="subs__more" aria-hidden="true">
          ▼
        </div>
      )}
    </div>
  );
};
