// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Configuration for experimental SSL/HTTPS support.
 * All SSL parameters are passed via command line - nothing is persisted.
 *
 * This is designed for the minor use case where users want to run
 * a small Minecraft server with HTTPS. Most users will use HTTP
 * on localhost for local development.
 */
export default interface ISslConfig {
  /** Path to PEM-encoded SSL certificate file */
  certPath?: string;

  /** Path to PEM-encoded private key file */
  keyPath?: string;

  /** Path to PKCS12/PFX certificate bundle (alternative to certPath + keyPath) */
  pfxPath?: string;

  /** Passphrase for encrypted PFX file */
  pfxPassphrase?: string;

  /** Path to CA certificate chain (optional) */
  caPath?: string;

  /** Port for HTTPS server (default: 443) */
  port?: number;

  /** If true, only start HTTPS (no HTTP) */
  httpsOnly?: boolean;
}
