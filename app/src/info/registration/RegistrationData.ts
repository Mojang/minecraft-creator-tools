import { ProjectInfoSuite } from "../IProjectInfoData";

type SuiteConfig = {
  performAddOnValidations: boolean;
  performPlatformVersionValidation: boolean;
  identifierOverridesAreErrors: boolean;
};

export const SuiteConfigs: Record<ProjectInfoSuite, SuiteConfig> = {
  [ProjectInfoSuite.cooperativeAddOn]: {
    performAddOnValidations: true,
    performPlatformVersionValidation: false,
    identifierOverridesAreErrors: true,
  },
  [ProjectInfoSuite.currentPlatformVersions]: {
    performAddOnValidations: false,
    performPlatformVersionValidation: true,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.sharing]: {
    performAddOnValidations: false,
    performPlatformVersionValidation: false,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.sharingStrict]: {
    performAddOnValidations: false,
    performPlatformVersionValidation: false,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.defaultInDevelopment]: {
    performAddOnValidations: false,
    performPlatformVersionValidation: false,
    identifierOverridesAreErrors: false,
  },
} as const;
