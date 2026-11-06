import { describe, it, expect } from "vitest";
import { initialTabs, tabsReducer, referenceNodes } from "../src/model";
import {
  normalize,
  applyOperation,
  collectFiles,
  findNode,
} from "../shared/library.mjs";
const file = (id) => ({
  id,
  name: id + ".md",
  path: "/tmp/" + id + ".md",
  relative: id + ".md",
});
describe("tabs", () => {
  it("replaces active by default and explicitly opens new tabs", () => {
    let s = initialTabs(),
      id = s.activeId;
    s = tabsReducer(s, { type: "open", file: file("a"), content: "a" });
    expect(s.tabs).toHaveLength(1);
    expect(s.activeId).toBe(id);
    s = tabsReducer(s, { type: "patch", patch: { zoom: 1.5, scroll: 160 } });
    s = tabsReducer(s, {
      type: "open",
      newTab: true,
      file: file("b"),
      content: "b",
    });
    expect(s.tabs).toHaveLength(2);
    s = tabsReducer(s, { type: "activate", id });
    expect(s.tabs[0]).toMatchObject({ zoom: 1.5, scroll: 160 });
    s = tabsReducer(s, { type: "new" });
    const empty = s.activeId;
    s = tabsReducer(s, { type: "open", file: file("c"), content: "c" });
    expect(s.tabs).toHaveLength(3);
    expect(s.activeId).toBe(empty);
    s = tabsReducer(s, { type: "close" });
    s = tabsReducer(s, { type: "reopen" });
    expect(s.activeId).toBe(empty);
  });
});
describe("shared library operations", () => {
  it("migrates legacy once and preserves 200-entry history", () => {
    let s = applyOperation(null, {
      type: "migrate",
      legacy: { theme: "dark", favorites: [file("a")], history: [file("b")] },
    });
    s = applyOperation(s, { type: "theme", value: "light" });
    s = applyOperation(s, { type: "migrate", legacy: { theme: "dark" } });
    expect(s.theme).toBe("light");
    expect(s.favorites[0].id).toBe("a");
    for (let i = 0; i < 205; i++)
      s = applyOperation(s, { type: "opened", file: file(String(i)) });
    s = applyOperation(s, { type: "opened", file: file("10") });
    expect(s.history).toHaveLength(200);
    expect(s.history[0].id).toBe("10");
    expect(new Set(s.history.map((f) => f.id)).size).toBe(200);
  });
  it("merges operations from stale windows instead of replacing snapshots", () => {
    let state = normalize();
    const staleA = state,
      staleB = state;
    state = applyOperation(state, {
      type: "favorite",
      file: file("a"),
      value: true,
      revision: staleA.revision,
    });
    state = applyOperation(state, {
      type: "favorite",
      file: file("b"),
      value: true,
      revision: staleB.revision,
    });
    expect(state.favorites.map((f) => f.id)).toEqual(["b", "a"]);
    state = applyOperation(state, {
      type: "favorite",
      file: file("a"),
      value: false,
    });
    state = applyOperation(state, { type: "opened", file: file("b") });
    expect(state.favorites.map((f) => f.id)).toEqual(["b"]);
  });
  it("normalizes malformed storage defensively", () => {
    expect(
      normalize({
        favorites: "bad",
        history: [null],
        workspaces: [{ id: "x", type: "folder", children: "bad" }],
      }),
    ).toMatchObject({
      favorites: [],
      history: [],
      workspaces: [{ id: "x", children: [] }],
    });
  });
  it("supports nested reference imports, deduplication, relink and recursive cleanup", () => {
    let s = applyOperation(null, {
      type: "workspace-create",
      id: "w",
      name: "Reading",
    });
    s = applyOperation(s, {
      type: "workspace-add",
      id: "w",
      nodes: referenceNodes([
        { ...file("a"), relative: "nested/a.md" },
        file("b"),
      ]),
    });
    s = applyOperation(s, {
      type: "workspace-add",
      id: "w",
      nodes: referenceNodes([file("a")]),
    });
    expect(collectFiles(s.workspaces)).toHaveLength(2);
    s = applyOperation(s, { type: "workspace-clean", id: "w", missing: ["a"] });
    expect(collectFiles(s.workspaces).map((f) => f.id)).toEqual(["b"]);
    const b = findNode(s.workspaces, "w").children.find(
      (n) => n.type === "file",
    );
    s = applyOperation(s, {
      type: "workspace-relink",
      id: b.id,
      file: file("c"),
    });
    expect(collectFiles(s.workspaces)[0].id).toBe("c");
    s = applyOperation(s, { type: "workspace-remove", id: "w" });
    expect(s.workspaces).toEqual([]);
  });
});

describe("workspace identity boundaries", () => {
  it("deduplicates across nested folders within one root while allowing other roots", () => {
    let s = applyOperation(null, {
      type: "workspace-create",
      id: "root",
      name: "Root",
    });
    s = applyOperation(s, {
      type: "workspace-create",
      id: "child",
      name: "Child",
      parent: "root",
    });
    s = applyOperation(s, {
      type: "workspace-create",
      id: "other",
      name: "Other",
    });
    s = applyOperation(s, {
      type: "workspace-add",
      id: "root",
      nodes: referenceNodes([file("same")]),
    });
    s = applyOperation(s, {
      type: "workspace-add",
      id: "child",
      nodes: referenceNodes([file("same")]),
    });
    s = applyOperation(s, {
      type: "workspace-add",
      id: "other",
      nodes: referenceNodes([file("same")]),
    });
    expect(collectFiles(findNode(s.workspaces, "root").children)).toHaveLength(
      1,
    );
    expect(collectFiles(findNode(s.workspaces, "child").children)).toHaveLength(
      0,
    );
    expect(collectFiles(findNode(s.workspaces, "other").children)).toHaveLength(
      1,
    );
  });
});
