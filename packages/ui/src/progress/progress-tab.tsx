import { useT } from "../i18n/use-t";
import { useUi } from "../use-ui";
import { AttributeList } from "./attribute-list";
import { PerkTree } from "./perk-tree";
import { RespecNote } from "./respec-note";
import { useProgressTree } from "./use-progress-tree";
import { XpMeter } from "./xp-meter";

/**
 * The Progress tab of the character screen (ADR-0059, stage 7, key K): the level and the XP bar,
 * the five attributes with their points, the chosen attribute's perk tree tier by tier, and where
 * the respec is. Points go through the narrow progression intents; the tree on show is the tab's own.
 */
export const ProgressTab = () => {
  const t = useT();
  const level = useUi((s) => s.level);
  const [tree, setTree] = useProgressTree();
  return (
    <div className="progress" data-testid="progress-tab">
      <header className="progress__head">
        <div className="progress__level" data-testid="progress-level">
          {t("attribute.level", { level })}
        </div>
        <XpMeter className="progress__xp" testId="progress-xp" />
      </header>
      <div className="progress__body">
        <div className="progress__left">
          <AttributeList tree={tree} onTree={setTree} />
          <RespecNote />
        </div>
        <PerkTree tree={tree} />
      </div>
    </div>
  );
};
