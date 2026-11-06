import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { findMatches, compileQuery } from "../src/search-core";
import {
  scopeFiles,
  searchDocuments,
  workerSearch,
} from "../src/services/search";
import { availability, boundedMap } from "../src/services/files";
import { browserOperation, handleStore } from "../src/services/store";
const a = { id: "a", name: "a.md", content: "Alpha beta\nALPHA beta" },
  b = { id: "b", name: "b.md", content: "Gamma" };
describe("search", () => {
  it("matches literal punctuation, case options, regex and source locations", () => {
    expect(findMatches(a.content, "alpha").matches).toHaveLength(2);
    expect(
      findMatches(a.content, "alpha", { caseSensitive: true }).matches,
    ).toHaveLength(0);
    expect(
      findMatches(a.content, "A\\w+", {
        regex: true,
        caseSensitive: true,
      }).matches.map((m) => m.line),
    ).toEqual([1, 2]);
    expect(findMatches("a.b aab", "a.b").matches).toHaveLength(1);
    expect(() => compileQuery("[", { regex: true })).toThrow();
    expect(findMatches("abc", "^|$", { regex: true }).matches).toEqual([]);
    expect(findMatches("a", "").matches).toEqual([]);
  });
  it("selects every scope and deduplicates references", () => {
    const sources = {
      tabs: [
        { file: a, content: "tab A" },
        { file: b, content: "tab B" },
      ],
      active: { file: a, content: "active" },
      folder: [b],
      favorites: [a],
      history: [b, a, b],
      workspace: [a, b],
    };
    for (const [scope, ids] of Object.entries({
      active: ["a"],
      tabs: ["a", "b"],
      folder: ["b"],
      favorites: ["a"],
      history: ["b", "a"],
      workspace: ["a", "b"],
    }))
      expect(scopeFiles(scope, sources).map((f) => f.id)).toEqual(ids);
    expect(scopeFiles("active", sources)[0]._content).toBe("active");
  });
  it("separates inaccessible documents, limits results and respects cancellation", async () => {
    const result = await searchDocuments(
      [a, b],
      "alpha",
      {},
      new AbortController().signal,
      {
        read: async (f) => {
          if (f === b) throw Error("Permission required");
          return f.content;
        },
        match: async (content, q, o) => findMatches(content, q, o),
      },
    );
    expect(result.groups).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(findMatches("a ".repeat(500), "a").matches).toHaveLength(200);
    const c = new AbortController();
    c.abort();
    await expect(
      searchDocuments([a], "a", {}, c.signal, {
        read: async () => a.content,
        match: async () => findMatches("a", "a"),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("bounds file reads to four and stops scheduling after cancel", async () => {
    let reading = 0,
      maximum = 0;
    await boundedMap(
      Array.from({ length: 12 }, (_, i) => i),
      async (i) => {
        maximum = Math.max(maximum, ++reading);
        await new Promise((r) => setTimeout(r, 2));
        reading--;
        return i;
      },
      { limit: 4 },
    );
    expect(maximum).toBe(4);
    const c = new AbortController();
    let calls = 0;
    await boundedMap(
      [1, 2, 3],
      async () => {
        calls++;
        c.abort();
      },
      { limit: 1, signal: c.signal },
    );
    expect(calls).toBe(1);
  });
  it("terminates workers on timeout and cancellation to isolate pathological regex", async () => {
    const terminate = vi.fn();
    class Frozen {
      terminate = terminate;
      postMessage() {}
    }
    await expect(
      workerSearch("aaaa!", "(a+)+$", { regex: true }, undefined, {
        WorkerClass: Frozen,
        timeout: 10,
      }),
    ).rejects.toThrow("timed out");
    expect(terminate).toHaveBeenCalledOnce();
    const c = new AbortController();
    const promise = workerSearch("a", "a", {}, c.signal, {
      WorkerClass: Frozen,
      timeout: 100,
    });
    c.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(terminate).toHaveBeenCalledTimes(2);
  });
});
describe("browser persistence and availability", () => {
  it("serializes concurrent stale-window operations with IndexedDB transactions", async () => {
    await Promise.all([
      browserOperation({ type: "favorite", file: a, value: true }),
      browserOperation({ type: "favorite", file: b, value: true }),
    ]);
    const final = await browserOperation({ type: "theme", value: "dark" });
    expect(final.favorites.map((f) => f.id).sort()).toEqual(["a", "b"]);
  });
  it("distinguishes snapshots, permissions and confirmed missing references", async () => {
    expect(await availability(a)).toBe("snapshot");
    expect(await availability({ id: "unknown" })).toBe("permission");
  });
});
