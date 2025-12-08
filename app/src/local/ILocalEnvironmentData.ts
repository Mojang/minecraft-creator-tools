// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface ILocalEnvironmentData {
  iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula?: boolean;

  worldContainerPath?: string;

  serverHostPort?: number;
  serverTitle?: string;
  serverDomainName?: string;
  serverMessageOfTheDay?: string;
  pathMappings?: { [path: string]: string };

  // Security: CORS configuration
  allowedCorsOrigins?: string[]; // List of allowed origins for CORS, e.g., ["http://localhost:3000", "https://example.com"]
}
