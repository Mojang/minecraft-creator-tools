import { ProjectInfoSuite } from "../IProjectInfoData";

type SuiteConfig = {
  performAddOnValidations: boolean;
  performPlatformVersionValidations: boolean;
  identifierOverridesAreErrors: boolean;
};

export const SuiteConfigs: Record<ProjectInfoSuite, SuiteConfig> = {
  [ProjectInfoSuite.cooperativeAddOn]: {
    performAddOnValidations: true,
    performPlatformVersionValidations: false,
    identifierOverridesAreErrors: true,
  },
  [ProjectInfoSuite.currentPlatformVersions]: {
    performAddOnValidations: false,
    performPlatformVersionValidations: true,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.sharing]: {
    performAddOnValidations: false,
    performPlatformVersionValidations: false,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.sharingStrict]: {
    performAddOnValidations: false,
    performPlatformVersionValidations: false,
    identifierOverridesAreErrors: false,
  },
  [ProjectInfoSuite.defaultInDevelopment]: {
    performAddOnValidations: false,
    performPlatformVersionValidations: false,
    identifierOverridesAreErrors: false,
  },
} as const;
