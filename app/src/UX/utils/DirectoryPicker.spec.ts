// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import {
  getUnsupportedDirectoryPickerMessage,
  IDirectoryPickerHost,
  isDirectoryPickerActive,
  isDirectoryPickerSupported,
  pickDirectory,
} from "./DirectoryPicker";

// Node has no DOMException with the browser's names; the picker only looks at
// `name` and `message`, which is what the real one exposes too.
class NamedError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

interface IFakeHandle {
  kind: "directory";
  name: string;
  queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
}

function fakeHandle(name: string, overrides: Partial<IFakeHandle> = {}): FileSystemDirectoryHandle {
  const handle: IFakeHandle = {
    kind: "directory",
    name,
    queryPermission: async () => "granted",
    ...overrides,
  };

  return handle as unknown as FileSystemDirectoryHandle;
}

/** A host whose picker stays open until the test settles it. */
function deferredHost() {
  let calls = 0;
  let settle: { resolve: (h: FileSystemDirectoryHandle) => void; reject: (e: unknown) => void } | undefined;

  const host: IDirectoryPickerHost = {
    showDirectoryPicker: () => {
      calls++;
      return new Promise<FileSystemDirectoryHandle>((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
  };

  return {
    host,
    get calls() {
      return calls;
    },
    resolve(handle: FileSystemDirectoryHandle) {
      settle!.resolve(handle);
    },
    reject(error: unknown) {
      settle!.reject(error);
    },
  };
}

describe("DirectoryPicker", () => {
  describe("support detection", () => {
    it("reports support only when the host has showDirectoryPicker", () => {
      expect(isDirectoryPickerSupported({ showDirectoryPicker: async () => fakeHandle("x") })).to.equal(true);
      expect(isDirectoryPickerSupported({})).to.equal(false);
      expect(isDirectoryPickerSupported({ showDirectoryPicker: undefined })).to.equal(false);
      expect(isDirectoryPickerSupported(undefined)).to.equal(false);
    });

    it("returns unsupported with guidance instead of calling into a missing API", async () => {
      const outcome = await pickDirectory({});

      expect(outcome.status).to.equal("unsupported");
      expect(outcome.status === "unsupported" && outcome.message).to.equal(getUnsupportedDirectoryPickerMessage());
      expect(getUnsupportedDirectoryPickerMessage()).to.include("Choose Files");
      expect(getUnsupportedDirectoryPickerMessage()).to.include("Android");
    });
  });

  describe("picking", () => {
    it("returns the handle the user picked", async () => {
      const handle = fakeHandle("my-pack");
      let receivedMode: string | undefined;
      const host: IDirectoryPickerHost = {
        showDirectoryPicker: async (options) => {
          receivedMode = options?.mode;
          return handle;
        },
      };

      const outcome = await pickDirectory(host, { mode: "readwrite" });

      expect(outcome).to.deep.equal({ status: "picked", handle });
      expect(receivedMode).to.equal("readwrite");
    });

    it("asks for readwrite permission and reports a refusal as a failure", async () => {
      const prompts: string[] = [];
      const denied = fakeHandle("locked", {
        queryPermission: async () => "prompt",
        requestPermission: async (d) => {
          prompts.push(d.mode);
          return "denied";
        },
      });
      const host: IDirectoryPickerHost = { showDirectoryPicker: async () => denied };

      const outcome = await pickDirectory(host);

      expect(outcome.status).to.equal("failed");
      expect(outcome.status === "failed" && outcome.message).to.include("Write permission");
      expect(prompts).to.deep.equal(["readwrite"]);
    });

    it("does not ask for write permission in read mode", async () => {
      let asked = false;
      const handle = fakeHandle("readonly", {
        queryPermission: async () => {
          asked = true;
          return "denied";
        },
        requestPermission: async () => {
          asked = true;
          return "denied";
        },
      });
      const host: IDirectoryPickerHost = { showDirectoryPicker: async () => handle };

      const outcome = await pickDirectory(host, { mode: "read" });

      expect(outcome.status).to.equal("picked");
      expect(asked).to.equal(false);
    });

    it("reports a permission API that throws as a failure", async () => {
      const handle = fakeHandle("broken", {
        queryPermission: async () => {
          throw new NamedError("InvalidStateError", "handle is gone");
        },
      });
      const host: IDirectoryPickerHost = { showDirectoryPicker: async () => handle };

      const outcome = await pickDirectory(host);

      expect(outcome).to.deep.equal({
        status: "failed",
        message: "Could not obtain write permission for the selected folder: handle is gone",
      });
    });
  });

  describe("cancellation and errors", () => {
    it("treats AbortError as a cancellation", async () => {
      const host: IDirectoryPickerHost = {
        showDirectoryPicker: async () => {
          throw new NamedError("AbortError", "The user aborted a request.");
        },
      };

      expect(await pickDirectory(host)).to.deep.equal({ status: "cancelled" });
    });

    it("treats a picker the browser reports as already active as busy", async () => {
      const host: IDirectoryPickerHost = {
        showDirectoryPicker: async () => {
          throw new NamedError("NotAllowedError", "File picker already active.");
        },
      };

      expect(await pickDirectory(host)).to.deep.equal({ status: "busy" });
    });

    it("reports a missing user gesture as an actionable failure", async () => {
      const host: IDirectoryPickerHost = {
        showDirectoryPicker: async () => {
          throw new NamedError("SecurityError", "Must be handling a user gesture to show a file picker.");
        },
      };

      const outcome = await pickDirectory(host);

      expect(outcome.status).to.equal("failed");
      expect(outcome.status === "failed" && outcome.message).to.include("Must be handling a user gesture");
      expect(outcome.status === "failed" && outcome.message).to.include("click the button again");
    });

    it("never rejects, whatever the picker throws", async () => {
      const thrown: unknown[] = [new Error("boom"), "a string", undefined, { message: "plain object" }];

      for (const value of thrown) {
        const host: IDirectoryPickerHost = {
          showDirectoryPicker: async () => {
            throw value;
          },
        };

        const outcome = await pickDirectory(host);

        expect(outcome.status, String(value)).to.equal("failed");
        expect(outcome.status === "failed" && outcome.message, String(value)).to.include(
          "Could not open a folder picker"
        );
      }
    });
  });

  describe("reentry", () => {
    it("opens one native picker for concurrent calls and reports the others as busy", async () => {
      const picker = deferredHost();

      const first = pickDirectory(picker.host);
      const second = pickDirectory(picker.host);
      const third = pickDirectory(picker.host);

      expect(picker.calls).to.equal(1);
      expect(isDirectoryPickerActive(picker.host)).to.equal(true);
      expect(await second).to.deep.equal({ status: "busy" });
      expect(await third).to.deep.equal({ status: "busy" });

      const handle = fakeHandle("chosen");
      picker.resolve(handle);

      expect(await first).to.deep.equal({ status: "picked", handle });
      expect(isDirectoryPickerActive(picker.host)).to.equal(false);
    });

    it("accepts a new call once the open picker is cancelled", async () => {
      const picker = deferredHost();

      const first = pickDirectory(picker.host);
      expect(await pickDirectory(picker.host)).to.deep.equal({ status: "busy" });

      picker.reject(new NamedError("AbortError", "The user aborted a request."));
      expect(await first).to.deep.equal({ status: "cancelled" });

      const next = pickDirectory(picker.host);
      expect(picker.calls).to.equal(2);
      picker.resolve(fakeHandle("second-try"));
      expect((await next).status).to.equal("picked");
    });

    it("releases the guard when the picker fails", async () => {
      const picker = deferredHost();

      const first = pickDirectory(picker.host);
      picker.reject(new NamedError("SecurityError", "no gesture"));
      expect((await first).status).to.equal("failed");

      expect(isDirectoryPickerActive(picker.host)).to.equal(false);
      const next = pickDirectory(picker.host);
      expect(picker.calls).to.equal(2);
      picker.resolve(fakeHandle("after-failure"));
      expect((await next).status).to.equal("picked");
    });

    it("releases the guard while permission is still being requested only after it settles", async () => {
      let settlePermission: ((state: PermissionState) => void) | undefined;
      const handle = fakeHandle("slow-permission", {
        queryPermission: () => new Promise<PermissionState>((resolve) => (settlePermission = resolve)),
      });
      const host: IDirectoryPickerHost = { showDirectoryPicker: async () => handle };

      const first = pickDirectory(host);
      await Promise.resolve();
      await Promise.resolve();

      expect(isDirectoryPickerActive(host)).to.equal(true);
      expect(await pickDirectory(host)).to.deep.equal({ status: "busy" });

      settlePermission!("granted");
      expect((await first).status).to.equal("picked");
      expect(isDirectoryPickerActive(host)).to.equal(false);
    });

    it("keeps separate hosts independent", async () => {
      const a = deferredHost();
      const b = deferredHost();

      const fromA = pickDirectory(a.host);
      const fromB = pickDirectory(b.host);

      expect(a.calls).to.equal(1);
      expect(b.calls).to.equal(1);

      a.resolve(fakeHandle("a"));
      b.resolve(fakeHandle("b"));

      expect((await fromA).status).to.equal("picked");
      expect((await fromB).status).to.equal("picked");
    });
  });
});
