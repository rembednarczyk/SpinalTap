import { useT } from "../i18n/use-t";
import { useCharacterIntents, useUi } from "../use-ui";
import { BonusIndicator } from "./contract-card";
import { HookList } from "./body-hud";

/** Key hints such as " [E]" in an objective line; a touch screen has no keys to name (ADR-0035). */
export const withoutKeyHints = (text: string): string => text.replace(/\s*\[[A-Za-z0-9]{1,5}\]/g, "");

/**
 * The tracked entry in the corner: its title and current objective. A click or a tap on them opens
 * the journal on the character screen, where the entry's steps and the choice of what to track are.
 */
export const ObjectiveCard = ({ touch }: { touch: boolean }) => {
  const t = useT();
  const questTitle = useUi((s) => s.questTitle);
  const objective = useUi((s) => s.objective);
  const { openCharacterScreen } = useCharacterIntents();
  if (!objective) return null;
  return (
    <div className="hud__objective" data-testid="objective">
      <button type="button" className="hud__objective-open" aria-label={t("hud.openJournal")} onClick={() => openCharacterScreen("journal")}>
        <div className="hud__quest-title">{questTitle}</div>
        <div>{touch ? withoutKeyHints(objective) : objective}</div>
      </button>
      <BonusIndicator />
      <HookList />
    </div>
  );
};
