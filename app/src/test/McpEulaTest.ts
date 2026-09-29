// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import LocalEnvironment from "../local/LocalEnvironment";
import MinecraftMcpServer from "../local/MinecraftMcpServer";

const EULA_ENV = "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA";
const DATA_DIR_ENV = "MCTOOLS_DATA_DIR";
const EULA_KEY = "iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula";

/** Minimal stand-in for LocalEnvironment: `onDisk` is what another process, such as `mct eula`, wrote. */
function createFakeEnvironment(accepted: boolean, onDisk = accepted) {
  return {
    accepted,
    onDisk,
    saved: false,
    async load() {},
    async reloadEulaAcceptance() {
      this.accepted = this.accepted || this.onDisk;
    },
    async saveEulaAcceptance() {
      this.accepted = true;
      this.saved = true;
    },
    get iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula() {
      return this.accepted;
    },
    set iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula(value: boolean) {
      this.accepted = value;
    },
  };
}

function createServer(env: ReturnType<typeof createFakeEnvironment> | LocalEnvironment) {
  const server = new MinecraftMcpServer() as any;
  server._env = env;
  server._creatorTools = {};
  return server;
}

describe("MinecraftMcpServer EULA handling", () => {
  let previousEnvValue: string | undefined;

  beforeEach(() => {
    previousEnvValue = process.env[EULA_ENV];
    delete process.env[EULA_ENV];
  });

  afterEach(() => {
    if (previousEnvValue === undefined) {
      delete process.env[EULA_ENV];
    } else {
      process.env[EULA_ENV] = previousEnvValue;
    }
  });

  const cases = [
    { name: "returns an actionable error when not accepted", accepted: false, onDisk: false, envVar: "", error: true },
    { name: "allows the call when already accepted", accepted: true, onDisk: true, envVar: "", error: false },
    {
      name: "picks up acceptance made by another process without a restart",
      accepted: false,
      onDisk: true,
      envVar: "",
      error: false,
    },
    { name: "accepts through the environment variable", accepted: false, onDisk: false, envVar: "true", error: false },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      if (testCase.envVar) {
        process.env[EULA_ENV] = testCase.envVar;
      }
      const env = createFakeEnvironment(testCase.accepted, testCase.onDisk);

      const result = await createServer(env)._eulaNotAcceptedResult();

      if (testCase.error) {
        expect(result?.isError).to.equal(true);
        expect(result?.content[0].text).to.contain("mct eula");
      } else {
        expect(result).to.equal(undefined);
      }
      if (testCase.envVar) {
        expect(env.saved).to.equal(true);
      }
    });
  }

  it("createProject returns the EULA error instead of reporting success", async () => {
    const folder = path.join(os.tmpdir(), `mct-eula-test-${process.pid}-${Date.now()}`);

    const result = await createServer(createFakeEnvironment(false))._createOp({
      folderPathToCreateProjectAt: folder,
      title: "Goblin Chef",
      newName: "goblin_chef",
      creator: "Test",
      template: "addonStarter",
    });

    expect(result.isError).to.equal(true);
    expect(result.content[0].text).to.contain("mct eula");
    expect(fs.existsSync(folder)).to.equal(false);
  });
});

describe("MinecraftMcpServer EULA handling with a real LocalEnvironment", () => {
  const savedEnv: { [name: string]: string | undefined } = {};
  let dataDir: string;
  let prefsFile: string;

  function writePrefs(content: string | object) {
    fs.mkdirSync(path.dirname(prefsFile), { recursive: true });
    fs.writeFileSync(prefsFile, typeof content === "string" ? content : JSON.stringify(content));
  }

  function readPrefs() {
    return JSON.parse(fs.readFileSync(prefsFile, "utf8"));
  }

  async function createLoadedEnvironment(prefs?: string | object) {
    if (prefs !== undefined) {
      writePrefs(prefs);
    }
    const env = new LocalEnvironment(false);
    await env.load();
    return env;
  }

  beforeEach(() => {
    for (const name of [EULA_ENV, DATA_DIR_ENV]) {
      savedEnv[name] = process.env[name];
    }
    delete process.env[EULA_ENV];
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mct-eula-env-"));
    process.env[DATA_DIR_ENV] = dataDir;
    prefsFile = path.join(dataDir, "server", "envprefs", "envprefs.json");
  });

  afterEach(() => {
    for (const name of Object.keys(savedEnv)) {
      if (savedEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = savedEnv[name];
      }
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("picks up acceptance from disk without reverting unsaved in-memory settings", async () => {
    const env = await createLoadedEnvironment({ serverTitle: "From disk", [EULA_KEY]: false });
    env.serverTitle = "Unsaved in memory";
    writePrefs({ serverTitle: "From disk", [EULA_KEY]: true });

    const result = await createServer(env)._eulaNotAcceptedResult();

    expect(result).to.equal(undefined);
    expect(env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula).to.equal(true);
    expect(env.serverTitle).to.equal("Unsaved in memory");
  });

  it("accepting through the environment variable keeps preferences saved by another process", async () => {
    const env = await createLoadedEnvironment({ serverTitle: "Original" });
    writePrefs({ serverTitle: "Saved by another process" });
    process.env[EULA_ENV] = "true";

    const result = await createServer(env)._eulaNotAcceptedResult();

    expect(result).to.equal(undefined);
    expect(readPrefs()).to.deep.equal({ serverTitle: "Saved by another process", [EULA_KEY]: true });
  });

  const unreadableCases = [
    { name: "missing", content: undefined },
    { name: "empty (mid-write)", content: "" },
    { name: "malformed", content: '{"serverTitle": "Trunc' },
  ];

  for (const testCase of unreadableCases) {
    it(`returns the EULA error when the preferences file is ${testCase.name}`, async () => {
      const env = await createLoadedEnvironment({ serverTitle: "Loaded at startup" });
      if (testCase.content === undefined) {
        fs.rmSync(prefsFile);
      } else {
        writePrefs(testCase.content);
      }

      const result = await createServer(env)._eulaNotAcceptedResult();

      expect(result?.isError).to.equal(true);
      expect(result?.content[0].text).to.contain("mct eula");
      expect(env.serverTitle).to.equal("Loaded at startup");
    });
  }

  for (const testCase of unreadableCases.filter((c) => c.content !== undefined)) {
    it(`accepting through the environment variable doesn't overwrite a preferences file that is ${testCase.name}`, async () => {
      const env = await createLoadedEnvironment({ serverTitle: "Stale in memory" });
      writePrefs(testCase.content as string);
      process.env[EULA_ENV] = "true";

      const result = await createServer(env)._eulaNotAcceptedResult();

      expect(result).to.equal(undefined);
      expect(env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula).to.equal(
        true
      );
      expect(fs.readFileSync(prefsFile, "utf8")).to.equal(testCase.content);
    });
  }

  it("accepting through the environment variable in a new data directory saves acceptance and defaults", async () => {
    const env = await createLoadedEnvironment();
    expect(fs.existsSync(prefsFile)).to.equal(false);
    process.env[EULA_ENV] = "true";

    const result = await createServer(env)._eulaNotAcceptedResult();

    expect(result).to.equal(undefined);
    const saved = readPrefs();
    expect(saved[EULA_KEY]).to.equal(true);
    expect(saved.worldContainerPath).to.be.a("string");
  });

  it("recovers once a malformed preferences file is rewritten with acceptance", async () => {
    const env = await createLoadedEnvironment({});
    const server = createServer(env);
    writePrefs("{");
    expect((await server._eulaNotAcceptedResult())?.isError).to.equal(true);

    writePrefs({ [EULA_KEY]: true });

    expect(await server._eulaNotAcceptedResult()).to.equal(undefined);
  });
});
