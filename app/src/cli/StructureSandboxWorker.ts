// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Worker-thread entry for structure build programs. `StructureProgramSandbox`
 * starts this worker and posts it one request at a time. The worker runs the
 * request with `StructureProgramSandboxCore` and posts back the result.
 *
 * Running programs off the main thread keeps the MCP server and CLI responsive,
 * and lets the host terminate a run that goes past its deadline. QuickJS is
 * still the security boundary; the worker only protects availability.
 *
 * esbuild bundles this file to `toolbuild/jsn/cli/StructureSandboxWorker.mjs`.
 * Keep its imports light (no `Log`), so the bundle stays small and fast to start.
 */

import { parentPort } from "worker_threads";
import StructureProgramSandboxCore, {
  IStructureSandboxRequest,
} from "../minecraft/structureProgram/StructureProgramSandboxCore";
import { StructureSandboxResult } from "../minecraft/structureProgram/StructureProgramTypes";

if (parentPort) {
  const port = parentPort;
  port.on("message", async (request: IStructureSandboxRequest) => {
    port.postMessage({ type: "started" });
    let result: StructureSandboxResult;
    try {
      result = await StructureProgramSandboxCore.run(request);
    } catch (e: unknown) {
      result = {
        ok: false,
        reason: "internal",
        detail: "The structure sandbox failed: " + (e instanceof Error ? e.message : String(e)),
        logs: [],
      };
    }
    const transfer: ArrayBuffer[] = [];
    if (result.ok) {
      const j = result.journal;
      transfer.push(
        j.xs.buffer as ArrayBuffer,
        j.ys.buffer as ArrayBuffer,
        j.zs.buffer as ArrayBuffer,
        j.tableIdx.buffer as ArrayBuffer
      );
    }
    port.postMessage({ type: "result", result }, transfer);
  });
}
