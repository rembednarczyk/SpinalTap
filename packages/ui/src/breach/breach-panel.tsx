import { useEffect, useMemo, useState } from "react";
import type { BreachDaemonId } from "@seki/core";
import { useHackIntents, useUi } from "../use-ui";
import { BREACH_SECONDS, type BreachCell, DAEMON_INFO, autoSolve, bufferOf, generateBreach, isFinished, isLegal, solvedDaemons } from "./breach-logic";

/** Random source of the layout; tests pass their own. */
export type BreachRng = () => number;

const Sequence = ({ codes, won, daemon }: { codes: readonly string[]; won: boolean; daemon: BreachDaemonId }) => {
  const info = DAEMON_INFO[daemon];
  return (
    <li className={`breach__daemon${won ? " breach__daemon--won" : ""}`} data-testid={`breach-daemon-${daemon}`}>
      <span className="breach__codes">
        {codes.map((c, i) => (
          <span key={i} className="breach__code">
            {c}
          </span>
        ))}
      </span>
      <span className="breach__daemon-name">
        {won ? "✓ " : ""}
        {info.name}
      </span>
      <span className="breach__daemon-effect">{info.effect}</span>
    </li>
  );
};

/**
 * The terminal minigame (Breach Protocol): a code matrix, the buffer and 1-3 daemon sequences.
 * Picks alternate between a row and a column; the active line is outlined and striped, not
 * only coloured. The timer starts with the first pick and can be turned off in the settings.
 */
export const BreachPanel = ({ rng = Math.random }: { rng?: BreachRng }) => {
  const breach = useUi((s) => s.breach);
  if (!breach) return null;
  return <BreachGame key={breach.terminalKey} daemons={breach.daemons} rng={rng} />;
};

const BreachGame = ({ daemons, rng }: { daemons: readonly BreachDaemonId[]; rng: BreachRng }) => {
  const intents = useHackIntents();
  const untimed = useUi((s) => s.settings.untimedBreach);
  const puzzle = useMemo(() => generateBreach(rng, daemons), [rng, daemons]);
  const [picks, setPicks] = useState<readonly BreachCell[]>([]);
  const [left, setLeft] = useState(BREACH_SECONDS);
  const started = picks.length > 0;
  const timedOut = !untimed && left <= 0;
  const done = timedOut || isFinished(puzzle, picks);
  const won = solvedDaemons(puzzle, picks);
  const buffer = bufferOf(puzzle, picks);

  useEffect(() => {
    if (untimed || !started || done) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, Math.round((l - 0.1) * 10) / 10)), 100);
    return () => clearInterval(t);
  }, [untimed, started, done]);

  const last = picks[picks.length - 1];
  // The line the next pick is in: the top row first, then the previous pick's column or row.
  const activeRow = !last ? 0 : picks.length % 2 === 0 ? last.row : null;
  const activeCol = last && picks.length % 2 === 1 ? last.col : null;

  return (
    <div className="breach" role="dialog" aria-label="Włamanie do terminala" data-testid="breach">
      <div className="breach__head">
        <span className="breach__eyebrow">Breach Protocol</span>
        {untimed ? (
          <span className="breach__timer breach__timer--off">bez limitu czasu</span>
        ) : (
          <span className={`breach__timer${left < 8 ? " breach__timer--low" : ""}`} data-testid="breach-timer">
            {started ? `${left.toFixed(1)} s` : `${BREACH_SECONDS} s · start po 1. wyborze`}
          </span>
        )}
      </div>
      <div className="breach__body">
        <div className="breach__matrix" role="grid" aria-label="Macierz kodów" style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}>
          {puzzle.matrix.map((row, r) =>
            row.map((code, c) => {
              const cell = { row: r, col: c };
              const used = picks.some((p) => p.row === r && p.col === c);
              const legal = !done && isLegal(puzzle, picks, cell);
              const active = !done && (activeRow === r || activeCol === c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  className={`breach__cell${active ? " breach__cell--line" : ""}${legal ? " breach__cell--legal" : ""}${used ? " breach__cell--used" : ""}`}
                  disabled={!legal}
                  aria-label={`${code}, wiersz ${r + 1}, kolumna ${c + 1}${used ? ", użyty" : ""}`}
                  data-testid={`breach-cell-${r}-${c}`}
                  onClick={() => setPicks([...picks, cell])}
                >
                  {used ? "[ ]" : code}
                </button>
              );
            }),
          )}
        </div>
        <div className="breach__side">
          <div className="breach__label">Bufor</div>
          <div className="breach__buffer" data-testid="breach-buffer">
            {Array.from({ length: puzzle.bufferSize }, (_, i) => (
              <span key={i} className={`breach__slot${buffer[i] ? " breach__slot--full" : ""}`}>
                {buffer[i] ?? ""}
              </span>
            ))}
          </div>
          <div className="breach__label">Sekwencje</div>
          <ul className="breach__daemons">
            {puzzle.sequences.map((s) => (
              <Sequence key={s.daemon} daemon={s.daemon} codes={s.codes} won={won.includes(s.daemon)} />
            ))}
          </ul>
        </div>
      </div>
      <div className="breach__actions">
        {done ? (
          <>
            <span className="breach__result" data-testid="breach-result">
              {timedOut ? "Czas minął. " : ""}
              {won.length > 0 ? `Wgrane: ${won.map((d) => DAEMON_INFO[d].name).join(", ")}` : "Nic nie wgrano"}
            </span>
            <button type="button" className="breach__btn breach__btn--go" onClick={() => intents.submitBreach(won)}>
              Zakończ
            </button>
          </>
        ) : (
          <>
            <button type="button" className="breach__btn" onClick={() => intents.submitBreach(autoSolve(puzzle))} title="Wgrywa najwyżej jeden demon">
              Autorozwiązanie (1 demon)
            </button>
            <button type="button" className="breach__btn breach__btn--ghost" onClick={() => intents.submitBreach(won)}>
              Odłącz
            </button>
          </>
        )}
      </div>
    </div>
  );
};
