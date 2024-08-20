// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ILocalEnvironmentData {
  iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula?: boolean;

  worldContainerPath?: string;

  displayReadOnlyPasscode?: string;
  displayReadOnlyPasscodeComplement?: string;

  fullReadOnlyPasscode?: string;
  fullReadOnlyPasscodeComplement?: string;

  updateStatePasscode?: string;
  updateStatePasscodeComplement?: string;

  adminPasscode?: string;
  adminPasscodeComplement?: string;

  tokenEncryptionPassword?: string;

  httpsKeyPath?: string;
  httpsCertPath?: string;
  caRootPath?: string;
  caBundleCertificatePath?: string;

  serverHostPort?: number;
  serverTitle?: string;
  serverDomainName?: string;
  serverMessageOfTheDay?: string;
}
