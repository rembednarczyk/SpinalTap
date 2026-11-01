import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";
import { DifficultyPicker } from "./difficulty-picker";
import { useNewGameDifficulty, useRunDifficulty } from "./use-difficulty";

/** Before a new game loads (ADR-0066): the difficulty, "normal" at first, then the start. */
export const NewGameSetup = ({ onBack }: { onBack: () => void }) => {
  const t = useT();
  const intents = useSessionIntents();
  const busy = useUi((s) => s.busy);
  const difficulty = useNewGameDifficulty();
  return (
    <div className="menu" data-testid="new-game-setup">
      <h2 className="difficulty__heading">{t("difficulty.heading")}</h2>
      <DifficultyPicker value={difficulty.value} onChange={difficulty.set} />
      <button type="button" className="menu__item" disabled={busy} onClick={() => intents.newGame(difficulty.value)}>
        {t("newGame.start")}
      </button>
      <button type="button" className="menu__item menu__item--ghost" onClick={onBack}>
        {t("menu.back")}
      </button>
    </div>
  );
};

/** The pause menu's difficulty: the same control, and a note when the change waits for the fight's end. */
export const PauseDifficulty = () => {
  const t = useT();
  const difficulty = useRunDifficulty();
  return (
    <div className="settings" data-testid="pause-difficulty">
      <h3 className="difficulty__heading">{t("difficulty.heading")}</h3>
      <DifficultyPicker value={difficulty.value} onChange={difficulty.set} />
      {difficulty.pending && (
        <p className="settings__note" role="status" data-testid="difficulty-pending">
          {t("difficulty.pending")}
        </p>
      )}
    </div>
  );
};
