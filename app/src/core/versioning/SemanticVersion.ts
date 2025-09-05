const VersionParts = 3;
/*
  immutable structure defining semantic versioning with 3 parts: major, minor, and patch
*/
export default class SemanticVersion {
  static parse(version?: string | number | number[] | null): SemanticVersion | undefined {
    if (!version) {
      return undefined;
    }

    if (Array.isArray(version)) {
      return SemanticVersion.fromArray(version);
    }
    if (typeof version === "number") {
      return SemanticVersion.fromNumber(version);
    }

    return SemanticVersion.fromString(version);
  }

  static fromNumber(version: number): SemanticVersion | undefined {
    if (version < 0) {
      return undefined;
    }

    const major = Math.floor(version);

    return new SemanticVersion(major, version - major, 0);
  }

  static fromString(version: string): SemanticVersion | undefined {
    const tokens = version.split(".");

    if (tokens.length === 0) {
      return undefined;
    }

    const versionNums = tokens.map((num) => parseInt(num));
    if (versionNums.some(Number.isNaN)) {
      return undefined;
    }

    return new SemanticVersion(versionNums[0], versionNums[1] || 0, versionNums[2] || 0);
  }

  static fromArray(versionNums?: number[] | null): SemanticVersion | undefined {
    if (!versionNums || versionNums.length !== VersionParts) {
      return undefined;
    }

    return new SemanticVersion(versionNums[0], versionNums[1], versionNums[2]);
  }

  get majorVersion(): number {
    return this.major;
  }
  get minorVersion(): number {
    return this.minor;
  }
  get patchVersion(): number {
    return this.patch;
  }

  constructor(private major: number, private minor: number, private patch: number) {}

  asString() {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  asArray() {
    return [this.major, this.minor, this.patch];
  }

  equals(other: SemanticVersion): boolean {
    return this.major === other.major && this.minor === other.minor && this.patch === other.patch;
  }

  increment(major: number = 0, minor: number = 0, patch: number = 0): SemanticVersion {
    return new SemanticVersion(this.major + major, this.minor + minor, this.patch + patch);
  }

  /*
    returns a numeric comparison value
    0 is equal, <0 (i.e. negative values) mean this is less than the other value, >0 mean this is greater than the other value
  */
  compareTo(other: SemanticVersion): number {
    return this.major - other.major || this.minor - other.minor || this.patch - other.patch;
  }
}
