// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { installDomGlobals, restoreDomGlobals, domWindow } from "../../../dataformux/fields/textboxFieldSpecSetup";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Directory, useDirectoryPicker } from "./UseDirectoryPicker";

// The shim installs jsdom globals at import time so react-dom loads with a DOM
// present; drop them again until the hooks below re-install them.
restoreDomGlobals();

// @types/react 18.3.0 does not yet declare React.act even though react 18.3.1 ships it.
const act: (callback: () => void | Promise<void>) => void | Promise<void> = (React as any).act;

type PickerHost = typeof globalThis;

/**
 * A stand-in for `window` whose directory picker stays open until the test
 * settles it, counting how many native dialogs were requested.
 */
function pickerHost() {
  let calls = 0;
  let settle: { resolve: (h: FileSystemDirectoryHandle) => void; reject: (e: unknown) => void } | undefined;

  const host = {
    showDirectoryPicker: () => {
      calls++;
      return new Promise<FileSystemDirectoryHandle>((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
  } as unknown as PickerHost;

  return {
    host,
    get calls() {
      return calls;
    },
    resolve(name: string) {
      settle!.resolve({ kind: "directory", name, queryPermission: async () => "granted" } as any);
    },
    reject(error: unknown) {
      settle!.reject(error);
    },
  };
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

interface IHookState {
  directory?: Directory;
  error?: { message: string } | null;
  isSupported: boolean;
  pick: () => Promise<void>;
}

interface IHarness {
  state(): IHookState;
  picked: (Directory | undefined)[];
  unmount(): void;
}

/**
 * Mounts a component that calls the hook and exposes its latest return value.
 */
function mount(host: PickerHost, config?: { checkUnsafeFiles?: boolean }): IHarness {
  let latest: IHookState | undefined;
  const picked: (Directory | undefined)[] = [];

  function Probe() {
    const [directory, pickDirectory, error, isSupported] = useDirectoryPicker(host, {
      onDirectoryPicked: (directory) => picked.push(directory),
      ...config,
    });

    latest = { directory, error, isSupported, pick: pickDirectory };

    return null;
  }

  const container = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(React.createElement(Probe));
  });

  return {
    state() {
      return latest!;
    },
    picked,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useDirectoryPicker", () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  let harness: IHarness | undefined;

  before(() => {
    installDomGlobals();
    process.on("unhandledRejection", onRejection);
  });

  after(() => {
    process.off("unhandledRejection", onRejection);
    restoreDomGlobals();
  });

  afterEach(() => {
    harness?.unmount();
    harness = undefined;
    expect(rejections, "unhandled rejections").to.deep.equal([]);
  });

  it("reports whether the host offers a directory picker", () => {
    harness = mount(pickerHost().host);
    expect(harness.state().isSupported).to.equal(true);
    harness.unmount();

    harness = mount({} as PickerHost);
    expect(harness.state().isSupported).to.equal(false);
  });

  it("opens one native picker when activated twice and delivers the folder once", async () => {
    const picker = pickerHost();
    harness = mount(picker.host);

    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = harness!.state().pick();
      second = harness!.state().pick();
      await second;
    });

    expect(picker.calls).to.equal(1);
    expect(harness.state().directory).to.equal(undefined);

    await act(async () => {
      picker.resolve("my-addon");
      await first;
    });
    await flush();

    expect(harness.state().directory?.name).to.equal("my-addon");
    expect(harness.state().error).to.equal(null);
    expect(harness.picked.map((d) => d?.name)).to.deep.equal(["my-addon"]);
  });

  it("leaves state untouched when the user cancels", async () => {
    const picker = pickerHost();
    harness = mount(picker.host);

    await act(async () => {
      const pending = harness!.state().pick();
      picker.reject(namedError("AbortError", "The user aborted a request."));
      await pending;
    });
    await flush();

    expect(picker.calls).to.equal(1);
    expect(harness.state().directory).to.equal(undefined);
    expect(harness.state().error).to.equal(undefined);
    expect(harness.picked).to.deep.equal([]);

    // The next activation opens a fresh dialog.
    await act(async () => {
      const pending = harness!.state().pick();
      picker.resolve("second-try");
      await pending;
    });
    await flush();

    expect(picker.calls).to.equal(2);
    expect(harness.state().directory?.name).to.equal("second-try");
  });

  it("exposes guidance instead of throwing on a browser without a picker", async () => {
    harness = mount({} as PickerHost);

    await act(async () => {
      await harness!.state().pick();
    });

    expect(harness.state().error?.message).to.include("Chrome and Edge");
    expect(harness.state().error?.message).to.include("Choose Files");
    expect(harness.state().directory).to.equal(undefined);
    expect(harness.picked).to.deep.equal([]);
  });

  it("surfaces a real picker failure as an error the component can show", async () => {
    const picker = pickerHost();
    harness = mount(picker.host);

    await act(async () => {
      const pending = harness!.state().pick();
      picker.reject(namedError("SecurityError", "Must be handling a user gesture to show a file picker."));
      await pending;
    });
    await flush();

    expect(harness.state().error?.message).to.include("Must be handling a user gesture");
    expect(harness.state().directory).to.equal(undefined);
    expect(harness.picked).to.deep.equal([]);
  });

  it("surfaces a picker the browser reports as already active as a no-op", async () => {
    const host = {
      showDirectoryPicker: async () => {
        throw namedError("NotAllowedError", "File picker already active.");
      },
    } as unknown as PickerHost;
    harness = mount(host);

    await act(async () => {
      await harness!.state().pick();
    });

    expect(harness.state().error).to.equal(undefined);
    expect(harness.state().directory).to.equal(undefined);
  });
});
