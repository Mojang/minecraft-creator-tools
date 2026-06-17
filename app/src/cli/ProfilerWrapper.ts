/**
 * ProfilerWrapper - CPU + memory profiling helpers for the CLI/worker.
 *
 * Three profile modes are supported:
 *
 *  1. `generateCpuTrace(name, fn)`             → `.cpuprofile` (open in Chrome
 *     DevTools → Performance / VS Code "Open CPU Profile"). Tracks where time
 *     is spent.
 *
 *  2. `generateSamplingHeapProfile(name, fn)`  → `.heapprofile`. Lightweight
 *     allocation sampler that records WHICH stack traces are responsible for
 *     allocations and how many bytes they allocated during `fn`. This is the
 *     best tool for answering "what is allocating all the memory?".
 *     Open in Chrome DevTools → Memory → Load profile.
 *
 *  3. `generateHeapSnapshot(name)`             → `.heapsnapshot`. Full V8 heap
 *     dump at a single moment in time. Open in Chrome DevTools → Memory.
 *     Shows every retained object, dominator tree, etc.
 *
 *  4. `generateMemoryProfile(name, fn)`        → all of the above plus periodic
 *     `process.memoryUsage()` samples logged to a `.memstats.json` file and a
 *     final snapshot taken at peak. Use this when you don't know what kind of
 *     memory issue you're chasing.
 *
 * All outputs land in `<cwd>/debugoutput/` (created if missing).
 *
 * NOTE on workers: validation runs inside a Node `worker_threads` Worker. To
 * actually capture real validation memory, the profiler must run INSIDE the
 * worker — see TaskWorker.ts, which wraps `executeTask` with one of these
 * helpers when `task.profileMode` is set.
 */
export default class ProfilerWrapper {
  /**
   * Ensure the debugoutput folder exists and return an absolute file path
   * inside it.
   */
  private static buildOutputPath(traceName: string, suffix: string): string {
    const fs = require("fs");
    const path = require("path");
    const debugOutputDir = path.join(process.cwd(), "debugoutput");
    if (!fs.existsSync(debugOutputDir)) {
      fs.mkdirSync(debugOutputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(debugOutputDir, `${traceName}-${timestamp}${suffix}`);
  }

  /**
   * Format a byte count as MB with 1 decimal.
   */
  private static fmtMb(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  /**
   * Capture a CPU profile while `functionToProfile` runs.
   * Returns the path to the generated `.cpuprofile` file.
   */
  static async generateCpuTrace(traceName: string, functionToProfile: () => void | Promise<void>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const { Session } = require("inspector");
      const session = new Session();

      try {
        session.connect();

        session.post("Profiler.enable", (err: Error | null) => {
          if (err) return reject(err);

          session.post("Profiler.start", async (err: Error | null) => {
            if (err) return reject(err);

            try {
              await functionToProfile();

              session.post("Profiler.stop", (err: Error | null, result: { profile: unknown }) => {
                session.disconnect();

                if (err) return reject(err);

                const filename = ProfilerWrapper.buildOutputPath(traceName + "-profile", ".cpuprofile");
                const fs = require("fs");
                fs.writeFileSync(filename, JSON.stringify(result.profile));
                console.log(`CPU profile saved to ${filename}`);
                resolve(filename);
              });
            } catch (error) {
              session.disconnect();
              reject(error);
            }
          });
        });
      } catch (error) {
        session.disconnect();
        reject(error);
      }
    });
  }

  /**
   * Capture an allocation sampling heap profile while `functionToProfile` runs.
   *
   * This is the lightweight "where are bytes being allocated" profiler. It
   * samples allocations (default ~32 KB granularity) and records the stack
   * trace for each sample. The output is a `.heapprofile` file that opens in
   * Chrome DevTools → Memory → Load profile.
   *
   * @param traceName name prefix for the output file
   * @param functionToProfile work to profile
   * @param samplingIntervalBytes bytes between samples (smaller = more detail,
   *   more overhead). Default 32768 (32 KB), Chrome's default.
   * @returns absolute path of the generated `.heapprofile`
   */
  static async generateSamplingHeapProfile(
    traceName: string,
    functionToProfile: () => void | Promise<void>,
    samplingIntervalBytes: number = 32768
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const { Session } = require("inspector");
      const session = new Session();

      try {
        session.connect();

        session.post("HeapProfiler.enable", (err: Error | null) => {
          if (err) return reject(err);

          session.post(
            "HeapProfiler.startSampling",
            { samplingInterval: samplingIntervalBytes },
            async (err: Error | null) => {
              if (err) return reject(err);

              try {
                await functionToProfile();

                session.post("HeapProfiler.stopSampling", (err: Error | null, result: { profile: unknown }) => {
                  session.disconnect();

                  if (err) return reject(err);

                  const filename = ProfilerWrapper.buildOutputPath(traceName + "-heapsample", ".heapprofile");
                  const fs = require("fs");
                  fs.writeFileSync(filename, JSON.stringify(result.profile));
                  console.log(`Heap sampling profile saved to ${filename}`);
                  resolve(filename);
                });
              } catch (error) {
                session.disconnect();
                reject(error);
              }
            }
          );
        });
      } catch (error) {
        session.disconnect();
        reject(error);
      }
    });
  }

  /**
   * Write a full V8 heap snapshot right now. Captures every reachable JS
   * object — useful for finding retained memory, but the file is big
   * (often several × current heap size).
   *
   * @param traceName name prefix for the output file
   * @returns absolute path of the generated `.heapsnapshot`
   */
  static generateHeapSnapshot(traceName: string): string {
    const v8 = require("v8");
    const filename = ProfilerWrapper.buildOutputPath(traceName + "-snapshot", ".heapsnapshot");
    v8.writeHeapSnapshot(filename);
    console.log(`Heap snapshot saved to ${filename}`);
    return filename;
  }

  /**
   * Combined memory profile: runs `functionToProfile` with the allocation
   * sampler active, records `process.memoryUsage()` every `pollMs`, writes a
   * heap snapshot at peak RSS, and dumps a stats JSON at the end.
   *
   * The summary printed to stdout shows peak RSS / heap, plus the top
   * allocation sites by self bytes from the sampling profile.
   */
  static async generateMemoryProfile(
    traceName: string,
    functionToProfile: () => void | Promise<void>,
    options?: { snapshotAtPeak?: boolean; pollMs?: number; samplingIntervalBytes?: number }
  ): Promise<{ heapProfile: string; memStats: string; peakSnapshot?: string }> {
    const fs = require("fs");
    const snapshotAtPeak = options?.snapshotAtPeak ?? true;
    const pollMs = options?.pollMs ?? 500;
    const samplingIntervalBytes = options?.samplingIntervalBytes ?? 32768;

    // Record memory samples on a timer.
    const samples: Array<{ ts: number; rss: number; heapUsed: number; heapTotal: number; external: number }> = [];
    let peakRss = 0;
    let peakSnapshotPath: string | undefined;

    const startTs = Date.now();
    const recordSample = (allowSnapshot: boolean) => {
      const m = process.memoryUsage();
      samples.push({
        ts: Date.now() - startTs,
        rss: m.rss,
        heapUsed: m.heapUsed,
        heapTotal: m.heapTotal,
        external: m.external,
      });
      if (allowSnapshot && snapshotAtPeak && m.rss > peakRss * 1.15 && m.rss > 256 * 1024 * 1024) {
        // RSS grew >15% since last peak snapshot AND we're past 256 MB.
        // Take a fresh peak snapshot.
        try {
          peakSnapshotPath = ProfilerWrapper.generateHeapSnapshot(traceName + "-peak");
        } catch (e) {
          console.warn("Failed to write peak heap snapshot:", e);
        }
        peakRss = m.rss;
      } else if (m.rss > peakRss) {
        peakRss = m.rss;
      }
    };

    recordSample(false);
    const timer = setInterval(() => recordSample(true), pollMs);
    // Avoid keeping the event loop alive just for sampling.
    if (typeof timer.unref === "function") {
      timer.unref();
    }

    let heapProfile: string;
    try {
      heapProfile = await ProfilerWrapper.generateSamplingHeapProfile(
        traceName,
        functionToProfile,
        samplingIntervalBytes
      );
    } finally {
      clearInterval(timer);
      recordSample(false);
    }

    const memStats = ProfilerWrapper.buildOutputPath(traceName + "-memstats", ".json");
    const finalMem = process.memoryUsage();
    const summary = {
      traceName,
      pid: process.pid,
      durationMs: Date.now() - startTs,
      samplingIntervalBytes,
      peakRss,
      finalRss: finalMem.rss,
      finalHeapUsed: finalMem.heapUsed,
      finalHeapTotal: finalMem.heapTotal,
      finalExternal: finalMem.external,
      finalArrayBuffers: (finalMem as any).arrayBuffers,
      sampleCount: samples.length,
      samples,
    };
    fs.writeFileSync(memStats, JSON.stringify(summary, null, 2));

    console.log("===== Memory profile summary =====");
    console.log(`  Trace name : ${traceName}`);
    console.log(`  Duration   : ${(summary.durationMs / 1000).toFixed(1)} s`);
    console.log(`  Peak RSS   : ${ProfilerWrapper.fmtMb(peakRss)}`);
    console.log(`  Final RSS  : ${ProfilerWrapper.fmtMb(finalMem.rss)}`);
    console.log(
      `  Final heap : ${ProfilerWrapper.fmtMb(finalMem.heapUsed)} used / ${ProfilerWrapper.fmtMb(finalMem.heapTotal)} total`
    );
    console.log(`  External   : ${ProfilerWrapper.fmtMb(finalMem.external)}`);
    if ((finalMem as any).arrayBuffers !== undefined) {
      console.log(`  ArrayBuffs : ${ProfilerWrapper.fmtMb((finalMem as any).arrayBuffers)}`);
    }
    console.log(`  Heap prof  : ${heapProfile}`);
    console.log(`  Mem stats  : ${memStats}`);
    if (peakSnapshotPath) {
      console.log(`  Peak snap  : ${peakSnapshotPath}`);
    }
    console.log("===================================");

    return { heapProfile, memStats, peakSnapshot: peakSnapshotPath };
  }
}
