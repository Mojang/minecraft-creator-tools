import BlockActor from "./BlockActor";

export default class CommandBlockActor extends BlockActor {
  command?: string;
  customName?: string;
  executeOnFirstTick?: boolean;
  lpCommandMode?: number;
  lpConditionalMode?: boolean;
  lpRedstoneMode?: boolean;
  lastExecution?: bigint;
  lastOutput?: string;
  lastOutputParams?: string[];
  successCount?: number;
  tickDelay?: number;
  trackOutput?: boolean;
  version?: number;
  auto?: boolean;
  conditionMet?: boolean;
  powered?: boolean;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("Command");
    if (tag) {
      this.command = tag.valueAsString;
    }

    tag = this.rootTag.find("CustomName");
    if (tag) {
      this.customName = tag.valueAsString;
    }

    tag = this.rootTag.find("ExecuteOnFirstTick");
    if (tag) {
      this.executeOnFirstTick = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("LPCommandMode");
    if (tag) {
      this.lpCommandMode = tag.valueAsInt;
    }

    tag = this.rootTag.find("LPCondionalMode"); // re: condional, that's sic
    if (tag) {
      this.lpConditionalMode = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("LPRedstoneMode");
    if (tag) {
      this.lpRedstoneMode = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("LastExecution");
    if (tag) {
      this.lastExecution = tag.valueAsBigInt;
    }

    tag = this.rootTag.find("LastOutput");
    if (tag) {
      this.lastOutput = tag.valueAsString;
    }

    tag = this.rootTag.find("LastOutputParams");
    if (tag) {
      this.lastOutputParams = tag.valueAsStringArray;
    }

    tag = this.rootTag.find("SuccessCount");
    if (tag) {
      this.successCount = tag.valueAsInt;
    }
    tag = this.rootTag.find("TickDelay");
    if (tag) {
      this.tickDelay = tag.valueAsInt;
    }

    tag = this.rootTag.find("TrackOutput");
    if (tag) {
      this.trackOutput = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("Version");
    if (tag) {
      this.version = tag.valueAsInt;
    }

    tag = this.rootTag.find("auto");
    if (tag) {
      this.auto = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("powered");
    if (tag) {
      this.powered = tag.valueAsBoolean;
    }
  }
}
