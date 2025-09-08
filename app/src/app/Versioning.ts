import SemanticVersion from "../core/versioning/SemanticVersion";

const Versioning = {
  FirstMinEngineVersionForFormatV2: new SemanticVersion(1, 13, 0),
  FirstMinEngineVersionForFormatV2EDU: new SemanticVersion(1, 15, 0),
  PublishedClientVersion: new SemanticVersion(1, 16, 0),
  MinimumAddOnVersion: new SemanticVersion(1, 20, 60),
  PublishedClientVersionEDUv1: new SemanticVersion(1, 12, 3),
  PublishedClientVersionEDU: new SemanticVersion(1, 14, 0),
  PublishedClientVersionEDUR17: new SemanticVersion(1, 17, 0),
  MaxClientVersion: new SemanticVersion(65535, 65535, 65535),
  InitialPackVersion: new SemanticVersion(1, 0, 0),
} as const;

export default Versioning;
