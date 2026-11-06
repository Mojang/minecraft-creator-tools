/// <reference types="node" />
import { expect } from "chai";
import * as path from "path";
import {
  ContentLogLineSplitter,
  ContentLogTail,
  IContentLogEntry,
  IContentLogFileSystem,
  IContentLogScheduler,
  isContentLogFileName,
  parseContentLogLine,
  parseContentLogText,
} from "../local/ContentLog";
import ContentLogWatcher from "../local/ContentLogWatcher";

/** An in-memory folder of log files whose contents and times tests can change between polls. */
class MemoryLogFolder implements IContentLogFileSystem {
  files = new Map<string, { data: Buffer; mtimeMs: number }>();
  /** How many more reads throw for each path, as if the file were locked. */
  failReads = new Map<string, number>();
  /** How many more stats throw for each path. */
  failStats = new Map<string, number>();
  /** How many more listings throw. */
  failLists = 0;
  readLengths: number[] = [];
  onRead: ((filePath: string, length: number) => void) | undefined;

  readonly folder: string;

  constructor(folder: string) {
    this.folder = folder;
  }

  write(name: string, text: string, mtimeMs: number) {
    this.files.set(path.join(this.folder, name), { data: Buffer.from(text, "utf8"), mtimeMs });
  }

  append(name: string, text: string, mtimeMs: number) {
    const key = path.join(this.folder, name);
    const existing = this.files.get(key)?.data ?? Buffer.alloc(0);
    this.files.set(key, { data: Buffer.concat([existing, Buffer.from(text, "utf8")]), mtimeMs });
  }

  list(folder: string) {
    if (this.failLists > 0) {
      this.failLists--;
      throw new Error("locked");
    }

    return [...this.files.keys()].filter((key) => path.dirname(key) === folder).map((key) => path.basename(key));
  }

  stat(filePath: string) {
    const failures = this.failStats.get(filePath) ?? 0;

    if (failures > 0) {
      this.failStats.set(filePath, failures - 1);
      throw new Error("locked");
    }

    const file = this.files.get(filePath);
    return file ? { size: file.data.length, mtimeMs: file.mtimeMs } : undefined;
  }

  read(filePath: string, start: number, length: number) {
    this.onRead?.(filePath, length);

    const failures = this.failReads.get(filePath) ?? 0;

    if (failures > 0) {
      this.failReads.set(filePath, failures - 1);
      throw new Error("locked");
    }

    this.readLengths.push(length);

    return this.files.get(filePath)!.data.subarray(start, start + length);
  }
}

/** Runs the watcher's polls only when a test calls tick(). */
class ManualScheduler implements IContentLogScheduler {
  callback: (() => void) | undefined;

  setInterval(callback: () => void) {
    this.callback = callback;
    return 1;
  }

  clearInterval() {
    this.callback = undefined;
  }

  tick(times: number) {
    for (let i = 0; i < times; i++) {
      this.callback?.();
    }
  }
}

/** Polls until nothing more comes back, so held-back entries are included. */
function drain(tail: ContentLogTail, polls = 50): string[] {
  const entries: IContentLogEntry[] = [];

  for (let i = 0; i < polls; i++) {
    entries.push(...tail.poll());
  }

  return entries.map((e) => e.message);
}

describe("Content log", () => {
  it("recognizes current and legacy content log file names", () => {
    expect(isContentLogFileName("ContentLog2026-10-18_12-30-29_1.txt")).to.equal(true);
    expect(isContentLogFileName("contentlog__2024_01_01.txt")).to.equal(true);
    expect(isContentLogFileName("ContentLog2026-10-18.log")).to.equal(false);
    expect(isContentLogFileName("SomethingElse.txt")).to.equal(false);
  });

  it("parses levels and categories, and folds continuation lines into their entry", () => {
    const entries = parseContentLogText(
      "12:31:11[Actor][error]-ns:mob | bad component\r\n" +
        "  at line 4\r\r\n" +
        "  at line 5\r\n" +
        "12:31:12[Sound][inform]-No sound found\r\n" +
        "12:31:13[Scripting][warning]-Slow tick\r\n" +
        "12:31:14[Molang][verbose]-detail\r\n"
    );

    expect(entries.map((e) => [e.time, e.category, e.level, e.message])).to.deep.equal([
      ["12:31:11", "Actor", "error", "ns:mob | bad component\n  at line 4\n  at line 5"],
      ["12:31:12", "Sound", "info", "No sound found"],
      ["12:31:13", "Scripting", "warning", "Slow tick"],
      ["12:31:14", "Molang", "verbose", "detail"],
    ]);
    expect(parseContentLogLine("   ")).to.equal(undefined);
  });

  it("holds back a partial last line until it's finished", () => {
    const splitter = new ContentLogLineSplitter();

    expect(splitter.push("12:00:00[A][error]-fir")).to.deep.equal([]);
    expect(splitter.push("st\r\n12:00:01[A][error]-sec")).to.deep.equal(["12:00:00[A][error]-first"]);
    expect(splitter.push("ond")).to.deep.equal([]);
    expect(splitter.flush()).to.deep.equal(["12:00:01[A][error]-second"]);
  });

  it("cuts an overlong line and drops the rest of it as it arrives", () => {
    const splitter = new ContentLogLineSplitter(25);

    for (let i = 0; i < 5; i++) {
      expect(splitter.push("0123456789")).to.deep.equal([]);
    }

    expect(splitter.push("\r\n12:00:00[A][error]-ok\r\n")).to.deep.equal([
      "0123456789".repeat(2) + "01234…",
      "12:00:00[A][error]-ok",
    ]);
    expect(new ContentLogLineSplitter(4).push("abc😀def\n"), "a surrogate pair isn't split").to.deep.equal(["abc…"]);
  });

  it("tails new entries, follows a newer file, and starts over when a file shrinks", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    fsys.write("ContentLog2026-01-01_10-00-00_1.txt", "10:00:00[Old][error]-before start\r\n", 1);
    fsys.write("notes.txt", "ignored", 5);
    fsys.failLists = 1;
    fsys.failReads.set(path.join(folder, "ContentLog2026-01-01_10-00-00_1.txt"), 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys });

    expect(tail.poll(), "the folder can't be listed yet").to.deep.equal([]);
    expect(tail.poll(), "the first file is read from its end").to.deep.equal([]);

    fsys.append("ContentLog2026-01-01_10-00-00_1.txt", "10:00:05[Item][error]-Missing icon\r\n  in item.j", 2);
    expect(tail.poll(), "an entry is held while more of it may come, and a failed read is retried").to.deep.equal([]);

    fsys.append("ContentLog2026-01-01_10-00-00_1.txt", "son\r\n", 2);
    expect(drain(tail), "a continuation split across polls").to.deep.equal(["Missing icon\n  in item.json"]);

    fsys.write("ContentLog2026-01-01_11-00-00_1.txt", "11:00:00[Json][warning]-new session\r\n", 3);
    expect(drain(tail), "a newer file is read from its start").to.deep.equal(["new session"]);
    expect(path.basename(tail.currentFile!)).to.equal("ContentLog2026-01-01_11-00-00_1.txt");

    fsys.write("ContentLog2026-01-01_11-00-00_1.txt", "11:00:09[Json][error]-x\r\n", 4);
    expect(drain(tail), "a shorter file is read again").to.deep.equal(["x"]);
  });

  it("finishes the current file in bounded reads before following a newer one, even while it's locked", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    // A 10-byte read limit splits the two-byte "é" across reads.
    fsys.write(
      "ContentLog_1.txt",
      "10:00:00[A][error]-é one\r\n10:00:01[A][error]-two\r\n10:00:02[A][error]-three\r\n",
      1
    );

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false, maxReadBytes: 10 });
    tail.poll();
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-new\r\n", 2);
    fsys.failReads.set(path.join(folder, "ContentLog_1.txt"), 10);
    fsys.failStats.set(path.join(folder, "ContentLog_1.txt"), 10);

    expect(drain(tail)).to.deep.equal(["é one", "two", "three", "new"]);
    expect(Math.max(...fsys.readLengths)).to.be.at.most(10);
  });

  it("gives up on an old file that stays unreadable or can't be checked, says so, and keeps following newer files", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    const unread = "10:00:01[A][error]-unreadable\r\n";
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-read\r\n", 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    tail.poll();
    fsys.append("ContentLog_1.txt", unread, 1);
    fsys.failReads.set(path.join(folder, "ContentLog_1.txt"), Infinity);
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-new\r\n", 2);

    const messages = drain(tail, 200);
    fsys.failStats.set(path.join(folder, "ContentLog_2.txt"), Infinity);
    fsys.write("ContentLog_3.txt", "12:00:00[C][info]-newer\r\n", 3);
    messages.push(...drain(tail, 200));

    expect(messages).to.deep.equal([
      "read",
      `Stopped reading ContentLog_1.txt: ${unread.length} bytes couldn't be read.`,
      "new",
      "Stopped reading ContentLog_2.txt: it couldn't be checked, so its last entries may be missing.",
      "newer",
    ]);
  });

  it("gives each new file it can't check its own retry window", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-a\r\n", 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    const messages = drain(tail, 1);
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-b\r\n", 2);
    fsys.failStats.set(path.join(folder, "ContentLog_2.txt"), 119);
    messages.push(...drain(tail, 119));
    // B can be checked again just as C appears and can't be checked yet.
    fsys.write("ContentLog_3.txt", "12:00:00[C][info]-c\r\n", 3);
    fsys.failStats.set(path.join(folder, "ContentLog_3.txt"), 5);
    messages.push(...drain(tail));

    expect(messages).to.deep.equal(["a", "b", "c"]);
  });

  it("reads new files in the order Minecraft started them, so neither late writes nor a file it can't check yet reorders them", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    const [a, b, c] = ["10-00-00", "11-00-00", "12-00-00"].map((time) => `ContentLog2026-10-18_${time}_1.txt`);
    fsys.write(a, "10:00:00[A][error]-a\r\n", 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    tail.poll();
    fsys.write(b, "11:00:00[B][info]-b\r\n", 2);
    fsys.failStats.set(path.join(folder, b), 3);
    fsys.write("contentlog__legacy.txt", "09:00:00[L][info]-legacy\r\n", 2.5);
    fsys.write(c, "12:00:00[C][info]-c\r\n", 3);
    fsys.append(a, "10:00:01[A][error]-late\r\n", 4);
    fsys.append(b, "11:00:01[B][info]-b late\r\n", 5);
    expect(drain(tail)).to.deep.equal(["a", "late", "legacy", "b", "b late", "c"]);

    fsys.append(a, "10:00:02[A][error]-after switching\r\n", 6);
    fsys.append(c, "12:00:01[C][info]-c2\r\n", 5);
    expect(drain(tail)).to.deep.equal(["c2"]);
  });

  it("waits a poll after reaching a file's end before switching, so a final write to it is read", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-a\r\n", 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    tail.poll();
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-b\r\n", 2);
    expect(tail.poll().map((entry) => entry.message)).to.deep.equal(["a"]);
    fsys.append("ContentLog_1.txt", "10:00:01[A][error]-final\r\n", 3);
    expect(drain(tail)).to.deep.equal(["final", "b"]);

    fsys.append("ContentLog_2.txt", "11:00:01[B][info]-b2\r\n", 4);
    expect(drain(tail)).to.deep.equal(["b2"]);
  });

  it("reads a file's new contents before switching when it shrinks as a newer file appears", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-first\r\n10:00:01[A][error]-second\r\n", 1);

    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    expect(tail.poll()).to.deep.equal([{ time: "10:00:00", category: "A", level: "error", message: "first" }]);
    fsys.write("ContentLog_1.txt", "10:00:05[A][error]-replaced\r\n", 2);
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-b\r\n", 3);

    expect(drain(tail)).to.deep.equal(["second", "replaced", "b"]);
  });

  it("stop() from the first callback cancels polling", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-one\r\n10:00:01[A][error]-two\r\n", 1);
    const tail = new ContentLogTail(folder, { fileSystem: fsys, startAtEnd: false });
    const scheduler = new ManualScheduler();
    const received: string[] = [];

    tail.start(
      (entries) => {
        received.push(...entries.map((e) => e.message));
        tail.stop();
      },
      500,
      scheduler
    );

    expect(received).to.deep.equal(["one"]);
    expect(scheduler.callback).to.equal(undefined);
  });

  it("catches up on recent files oldest first, finishing each one, so a write to an older file during startup is read", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    const older = path.join(folder, "ContentLog_1.txt");
    fsys.write("ContentLog_1.txt", "10:00:00[A][error]-a\r\n", 1);
    fsys.write("ContentLog_2.txt", "11:00:00[B][info]-b\r\n", 2);
    fsys.onRead = (filePath, length) => {
      if (filePath === older && length > 1) {
        fsys.onRead = undefined;
        fsys.append("ContentLog_1.txt", "10:00:01[A][error]-late\r\n", 3);
      }
    };

    const tail = new ContentLogTail(folder, { fileSystem: fsys, catchUpSinceMs: 0 });

    expect(drain(tail)).to.deep.equal(["a", "late", "b"]);
  });

  it("watcher reads recent entries, then new ones, once each and in order, across startup writes, a new file and failed reads", () => {
    const folder = path.join(path.sep, "logs");
    const fsys = new MemoryLogFolder(folder);
    const older = path.join(folder, "ContentLog_1.txt");
    const newest = path.join(folder, "ContentLog_2.txt");
    const now = Date.now();
    fsys.write("ContentLog_1.txt", "09:00:00[Old][error]-locked\r\n", now - 2000);
    fsys.write("ContentLog_2.txt", "x".repeat(300 * 1024) + "\r\n10:00:00[A][error]-recent\r\n", now - 1000);
    fsys.failReads.set(older, 1);
    fsys.failReads.set(newest, 1);

    // While startup reads the older file, Minecraft starts a new log; while it reads the newest
    // file, Minecraft appends to it.
    fsys.onRead = (filePath, length) => {
      if (filePath === older && length > 1) {
        fsys.write("ContentLog_3.txt", "11:00:00[B][info]-new file\r\n", now);
      } else if (filePath === newest && length > 1) {
        fsys.onRead = undefined;
        fsys.append("ContentLog_2.txt", "10:00:01[A][error]-during startup\r\n", now - 1000);
      }
    };

    const scheduler = new ManualScheduler();
    const watcher = new ContentLogWatcher(
      undefined as unknown as ConstructorParameters<typeof ContentLogWatcher>[0],
      fsys,
      scheduler
    );
    watcher.watchLogFolder(folder);
    scheduler.tick(10);

    expect(watcher.logItems.map((item) => [item.fileName, item.message])).to.deep.equal([
      ["ContentLog_1.txt", "locked"],
      ["ContentLog_2.txt", "recent"],
      ["ContentLog_2.txt", "during startup"],
      ["ContentLog_3.txt", "new file"],
    ]);
    expect(Math.max(...fsys.readLengths), "catch-up doesn't read the whole file").to.be.below(300 * 1024);

    watcher.stop();
    expect(scheduler.callback, "stop() cancels later polls").to.equal(undefined);
  });

  it("reports nothing when the folder has no content log", () => {
    const tail = new ContentLogTail(path.join(path.sep, "missing"), { fileSystem: new MemoryLogFolder("x") });

    expect(tail.poll()).to.deep.equal([]);
    expect(tail.findNewestFile()).to.equal(undefined);
  });
});
