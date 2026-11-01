import type { PrepareStage } from "@seki/core";
import type { MessageKey } from "../i18n/en";
import { useT } from "../i18n/use-t";
import { useUi } from "../use-ui";

const STAGE_KEY: Readonly<Record<PrepareStage, MessageKey>> = {
  models: "loading.stage.models",
  cityKit: "loading.stage.cityKit",
  city: "loading.stage.city",
  shaders: "loading.stage.shaders",
};

/**
 * The start of a game (ADR-0057): a bar of what the renderer has prepared and the stage under
 * way. Nothing to press: the game starts by itself once every stage is over.
 */
export const LoadingScreen = () => {
  const { progress, stage } = useUi((s) => s.loading);
  const t = useT();
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="screen screen--loading" data-testid="loading-screen">
      <h2 className="screen__heading">{t("loading.heading")}</h2>
      <div className="loading__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("loading.heading")}>
        <div className="loading__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="screen__sub loading__stage" data-testid="loading-stage">
        {stage ? t(STAGE_KEY[stage]) : " "}
      </p>
    </div>
  );
};
