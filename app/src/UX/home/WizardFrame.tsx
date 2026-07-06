// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ReactNode } from "react";
import { IntlShape } from "react-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faCheck } from "@fortawesome/free-solid-svg-icons";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

export interface IWizardFrameProps {
  intl: IntlShape;
  typeName: string;
  title: string;
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onCancel: () => void;
  onPrimary: () => void;
  isLastStep: boolean;
  children: ReactNode;
}

export default function WizardFrame(props: IWizardFrameProps) {
  const { intl, typeName, title, currentStep, totalSteps, onBack, onCancel, onPrimary, isLastStep, children } = props;

  return (
    <div className={"cwiz-wizard" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " cwiz-dark" : "")}>
      <div className="cwiz-wizard-header">
        <h2 className="cwiz-wizard-title">{intl.formatMessage({ id: "wizard.create_type" }, { typeName })}</h2>
        <div className="cwiz-wizard-step-indicator">
          {intl.formatMessage({ id: "wizard.step_indicator" }, { current: currentStep + 1, total: totalSteps, title })}
        </div>
        <div className="cwiz-wizard-progress">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`cwiz-progress-dot ${i <= currentStep ? "cwiz-progress-dot-active" : ""}`} />
          ))}
        </div>
      </div>
      <div className="cwiz-wizard-body">{children}</div>
      <div className="cwiz-wizard-footer">
        <button className="cwiz-btn cwiz-btn-stone" onClick={onBack} disabled={currentStep === 0}>
          <FontAwesomeIcon icon={faArrowLeft} />
          {intl.formatMessage({ id: "wizard.back" })}
        </button>
        <button className="cwiz-btn cwiz-btn-stone" onClick={onCancel}>
          {intl.formatMessage({ id: "wizard.cancel" })}
        </button>
        {isLastStep ? (
          <button className="cwiz-btn cwiz-btn-primary" onClick={onPrimary}>
            <FontAwesomeIcon icon={faCheck} />
            {intl.formatMessage({ id: "wizard.create" })}
          </button>
        ) : (
          <button className="cwiz-btn cwiz-btn-primary" onClick={onPrimary}>
            <FontAwesomeIcon icon={faArrowRight} />
            {intl.formatMessage({ id: "wizard.next" })}
          </button>
        )}
      </div>
    </div>
  );
}
