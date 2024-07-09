// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Packument } from "@npm/types";

export default class NpmModule {
  packument: Packument;

  latest: string | undefined;
  beta: string | undefined;
  betaVersion: string | undefined;
  betaProductVersion: string | undefined;
  latestPreviewVersion: string | undefined;
  latestRetailVersion: string | undefined;

  constructor(packument: Packument) {
    this.packument = packument;

    if (this.packument["dist-tags"]) {
      this.latest = this.packument["dist-tags"].latest;
      this.beta = this.packument["dist-tags"].beta;
    }

    if (this.beta) {
      // e.g., 1.3.0-beta.1.20.0-preview.23;
      const betaTag = this.beta.indexOf("-beta.");

      if (betaTag > 0) {
        this.betaVersion = this.beta.substring(0, betaTag);
        this.betaProductVersion = this.beta.substring(betaTag + 6);
        const dash = this.betaProductVersion.indexOf("-");

        if (dash >= 0) {
          this.latestPreviewVersion = this.betaProductVersion.substring(dash);

          const nums = this.latestPreviewVersion.split(".");

          if (nums.length === 3) {
            if (nums[2] === "0") {
              this.latestRetailVersion = nums[0] + "." + (parseInt(nums[1]) - 1).toString() + ".0";
            } else {
              this.latestRetailVersion = nums[0] + "." + nums[1] + "." + (parseInt(nums[2]) - 10).toString();
            }
          }
        }
      }
    }
  }
}
