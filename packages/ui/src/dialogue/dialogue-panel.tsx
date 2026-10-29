import type { DialogueVm } from "../store/ui-vm";
import { useDialogueIntents, useUi } from "../use-ui";
import { DialogueLog } from "./dialogue-log";
import { DialogueWheel } from "./dialogue-wheel";
import { useDialogueWheel } from "./use-dialogue-wheel";
import "./dialogue.css";

const NO_LINES: readonly never[] = [];

const Conversation = ({ dialogue }: { dialogue: DialogueVm }) => {
  const wheel = useDialogueWheel(dialogue, useDialogueIntents());
  return (
    <div className="dialogue" data-testid="dialogue">
      <DialogueWheel slots={wheel.slots} hot={wheel.hot} onPoint={wheel.point} onPick={wheel.pick} />
      <DialogueLog history={dialogue.history ?? NO_LINES} lines={dialogue.lines} />
    </div>
  );
};

/** The conversation on screen: the choice wheel by the speaker, subtitles at the bottom (ADR-0039). */
export const DialoguePanel = () => {
  const dialogue = useUi((s) => s.dialogue);
  return dialogue ? <Conversation dialogue={dialogue} /> : null;
};
