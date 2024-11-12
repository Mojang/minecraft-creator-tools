// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ILocalEnvironmentData {
  iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula?: boolean;

  worldContainerPath?: string;

  serverHostPort?: number;
  serverTitle?: string;
  serverDomainName?: string;
  serverMessageOfTheDay?: string;
}
